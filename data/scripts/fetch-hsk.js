/**
 * fetch-hsk.js — Tải TỪ ĐIỂN TIẾNG TRUNG theo cấp độ HSK 1 → 6 (chuẩn HSK 2.0).
 *
 * Nguồn: drkameleon/complete-hsk-vocabulary (GitHub, public — bộ từ vựng HSK
 *         đầy đủ cho cả HSK 2.0 lẫn 3.0): https://github.com/drkameleon/complete-hsk-vocabulary
 * Dùng wordlists/inclusive/old/{1..6}.json — bộ "old" = HSK 2.0 cổ điển
 * (150 / 150 / 300 / 600 / 1300 / 2500 từ), mỗi entry có:
 *   simplified  : chữ Hán giản thể
 *   pos         : mã từ loại CC-CEDICT (["v","n","adj",…])
 *   frequency   : tần suất (mẫu SUBTLEX-CH)
 *   forms[0].transcriptions.pinyin : phiên âm (có thanh điệu, vd "ài hào")
 *   forms[0].meanings              : các nghĩa tiếng Anh
 *
 * Các file level là CUMULATIVE (level 6 chứa cả level 1..5) — script giữ 1 từ
 * ở ĐÚNG cấp độ ĐẦU TIÊN xuất hiện → 4.991 từ unique.
 *
 * Đầu ra: data/raw/hsk-dictionary.jsonl — schema GIỐNG enriched của tiếng Anh:
 *   {"word","partOfSpeech","definition","examples","synonyms","antonyms",
 *    "ipa"(=pinyin),"freq","level"}   (vi để trống → enrich-vi-ipa.py điền)
 *
 * Cách chạy:
 *   node data/scripts/fetch-hsk.js            # tải + ghi data/raw/hsk-dictionary.jsonl
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'data', 'raw', 'hsk-dictionary.jsonl');
const BASE = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/master/wordlists/inclusive/old/';
const LEVELS = [1, 2, 3, 4, 5, 6];

/** Mã từ loại CC-CEDICT → tên tiếng Anh (để build-lessons normPOS hiểu) */
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

/** Làm sạch nghĩa tiếng Anh (bỏ phần "to do sth" cồng kềnh, giới hạn dài) */
function cleanEN(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function meaningText(m) {
  // "to love; to be fond of; to like" → "love / be fond of / like"? Giữ nguyên bản gốc.
  return cleanEN(m, 220);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
  return res.json();
}

async function main() {
  console.log('📡 Tải HSK 1–6 từ complete-hsk-vocabulary (wordlists/inclusive/old)…');
  const seen = new Map(); // word -> {level, entry}
  const stats = [];
  for (const L of LEVELS) {
    const url = BASE + L + '.json';
    const arr = await fetchJSON(url);
    let kept = 0;
    for (const e of arr) {
      const word = String(e.simplified || '').trim();
      if (!word || seen.has(word)) continue;
      const f = (e.forms || [])[0];
      const pinyin = String((f && f.transcriptions && f.transcriptions.pinyin) || '').trim();
      if (!pinyin) continue;
      const meanings = (f && f.meanings) || [];
      if (!meanings.length) continue;
      seen.set(word, { level: L, entry: e, pinyin, meanings });
      kept++;
    }
    stats.push(`${L}: ${kept} từ mới`);
    console.log(`   HSK ${L} → +${kept} từ unique (tổng ${seen.size})`);
  }

  // Ghi JSONL — 1 dòng mỗi NGHĨA (đa nghĩa → nhiều dòng, giống english enriched)
  const lines = [];
  for (const [word, { level, entry, pinyin, meanings }] of seen) {
    const pos = normPOS(entry.pos);
    const freq = typeof entry.frequency === 'number' ? entry.frequency : 0;
    meanings.forEach((m, i) => {
      const def = meaningText(m);
      if (!def) return;
      lines.push(JSON.stringify({
        word,
        partOfSpeech: pos,
        definition: def,
        examples: [],
        synonyms: [],
        antonyms: [],
        ipa: pinyin,
        freq,
        level,
        _ord: i,
      }));
    });
  }
  // Sắp theo cấp độ, rồi tần suất giảm dần, rồi thứ tự nghĩa
  lines.sort((a, b) => {
    const A = JSON.parse(a), B = JSON.parse(b);
    if (A.level !== B.level) return A.level - B.level;
    if (B.freq !== A.freq) return B.freq - A.freq;
    return A._ord - B._ord;
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.map((l) => l.replace(/,"_ord":\d+/, '')).join('\n') + '\n', 'utf-8');

  console.log('\n✅ Đã ghi: ' + OUT + ' (' + lines.length + ' dòng / ' + seen.size + ' từ)');
  console.log('   Theo cấp: ' + stats.join(' · '));
  console.log('\n➡️  Tiếp theo — làm giàu nghĩa Việt:');
  console.log('   python data/scripts/enrich-vi-ipa.py --sl auto --skip-ipa \\');
  console.log('     --in data/raw/hsk-dictionary.jsonl --out data/raw/hsk-dictionary.enriched.jsonl');
}

main().catch((err) => { console.error('✗', err.message); process.exit(1); });