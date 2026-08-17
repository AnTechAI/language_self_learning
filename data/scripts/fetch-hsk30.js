/**
 * fetch-hsk30.js — Tải TỪ ĐIỂN TIẾNG TRUNG theo HSK 3.0 (cấp 1 → 6).
 *
 * Nguồn: drkameleon/complete-hsk-vocabulary (GitHub, public):
 *   https://github.com/drkameleon/complete-hsk-vocabulary
 * Dùng wordlists/inclusive/new/{1..6}.json — bộ "new" = HSK 3.0 (2021),
 * mỗi entry có: simplified, traditional, radical, frequency, pos (CC-CEDICT),
 * forms[0].transcriptions.{pinyin, numeric, ...}, forms[0].meanings[],
 * forms[0].classifiers[].
 *
 * File level là CUMULATIVE → giữ 1 từ ở cấp ĐẦU TIÊN xuất hiện
 * (tổng ~5.363 từ cho cấp 1–6; schema thiết kế: docs/chinese_design.md §3).
 *
 * Đầu ra: data/raw/hsk30-dictionary.jsonl — 1 dòng mỗi NGHĨA:
 *   {id, simplified, traditional, pinyin, pinyin_numeric, hsk_level, pos,
 *    meaning_en, meaning_vi:"" , radical, classifier, frequency_rank, _ord}
 * (meaning_vi được enrich-vi-ipa.py điền sau; _ord bị xóa khi ghi).
 *
 * Cách chạy:
 *   node data/scripts/fetch-hsk30.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'data', 'raw', 'hsk30-dictionary.jsonl');
const BASE = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/master/wordlists/inclusive/new/';
const LEVELS = [1, 2, 3, 4, 5, 6];

/** Mã từ loại CC-CEDICT → tên tiếng Anh (như fetch-hsk.js) */
const POS_ZH = {
  v: 'verb', vn: 'verb', vx: 'verb', vb: 'verb',
  n: 'noun', nr: 'noun', ns: 'noun', nt: 'noun', nz: 'noun', ng: 'noun',
  adj: 'adjective', ag: 'adjective', b: 'adjective',
  adv: 'adverb', ad: 'adverb', d: 'adverb',
  prep: 'preposition', p: 'preposition',
  conj: 'conjunction', c: 'conjunction',
  pron: 'pronoun', r: 'pronoun', rr: 'pronoun',
  num: 'numeral', m: 'measure word', q: 'measure word',
  part: 'particle', u: 'particle', ul: 'particle',
  interj: 'interjection', e: 'interjection', int: 'interjection',
  aux: 'auxiliary', cc: 'auxiliary',
  pn: 'pronoun', t: 'time word', s: 'place word', o: 'onomatopoeia',
  i: 'idiom', cheng: 'idiom', l: 'idiom', j: 'idiom', g: 'morpheme', h: 'morpheme',
};

function normPOS(codes) {
  const seen = new Set();
  const out = [];
  for (const c of (codes || [])) {
    const k = String(c).toLowerCase();
    const v = POS_ZH[k];
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
    else if (!v && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out.join(' / ');
}

function cleanEN(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
  return res.json();
}

async function main() {
  console.log('📡 Tải HSK 3.0 (new/) 1–6 từ complete-hsk-vocabulary…');
  const seen = new Map(); // simplified -> {level, entry}
  const ord = new Map(); // word -> số nghĩa đã thêm (để id ổn định)
  for (const L of LEVELS) {
    const arr = await fetchJSON(BASE + L + '.json');
    let kept = 0;
    for (const e of arr) {
      const word = String(e.simplified || '').trim();
      if (!word || seen.has(word)) continue;
      const f = (e.forms || [])[0];
      const pinyin = String((f && f.transcriptions && f.transcriptions.pinyin) || '').trim();
      const numeric = String((f && f.transcriptions && f.transcriptions.numeric) || '').trim();
      if (!pinyin) continue;
      const meanings = (f && f.meanings) || [];
      if (!meanings.length) continue;
      seen.set(word, { level: L, entry: e, pinyin, numeric, meanings });
      kept++;
    }
    console.log(`   HSK ${L} → +${kept} từ unique (tổng ${seen.size})`);
  }

  const lines = [];
  let k = 0;
  for (const [word, { level, entry, pinyin, numeric, meanings }] of seen) {
    k++;
    const pos = normPOS(entry.pos);
    const traditional = String((entry.forms || [])[0].traditional || word);
    const classifier = String(((entry.forms || [])[0].classifiers || [])[0] || '').trim();
    const radical = String(entry.radical || '').trim();
    const freq = typeof entry.frequency === 'number' ? entry.frequency : 0;
    meanings.forEach((m, i) => {
      const def = cleanEN(m, 220);
      if (!def) return;
      // Row tương thích pipeline (enrich/build-lessons đọc word/definition/ipa/vi/level)
      // + field thừa để build-hsk30.js làm hsk.json theo schema THIẾT KẾ (chinese_design.md §3).
      lines.push(JSON.stringify({
        word,
        definition: def,
        partOfSpeech: pos,
        examples: [],
        synonyms: [],
        antonyms: [],
        ipa: pinyin,          // pinyin (có thanh điệu)
        pinyin_numeric: numeric,
        level,
        freq,
        traditional,
        radical,
        classifier,
        _ord: i,
      }));
    });
  }
  // Cấp → tần suất → thứ tự nghĩa
  lines.sort((a, b) => {
    const A = JSON.parse(a), B = JSON.parse(b);
    if (A.hsk_level !== B.hsk_level) return A.hsk_level - B.hsk_level;
    if (B.frequency_rank !== A.frequency_rank) return B.frequency_rank - A.frequency_rank;
    return A._ord - B._ord;
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.map((l) => l.replace(/,"_ord":\d+/, '')).join('\n') + '\n', 'utf-8');

  console.log('\n✅ Đã ghi: ' + OUT + ' (' + lines.length + ' dòng / ' + seen.size + ' từ)');
  console.log('➡️  Làm giàu nghĩa Việt:');
  console.log('   python data/scripts/enrich-vi-ipa.py --sl auto --skip-ipa \\');
  console.log('     --in data/raw/hsk30-dictionary.jsonl --out data/raw/hsk30-dictionary.enriched.jsonl');
}

main().catch((err) => { console.error('✗', err.message); process.exit(1); });