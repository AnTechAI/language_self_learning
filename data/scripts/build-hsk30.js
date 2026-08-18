/**
 * build-hsk30.js — Dựng DỮ LIỆU ỨNG DỤNG cho khóa tiếng Trung từ HSK 3.0 đã làm giàu.
 *
 * Đọc:  data/raw/hsk30-dictionary.enriched.jsonl (word/definition/vi/ipa/pinyin_numeric/
 *        level/freq/traditional/radical/classifier — do fetch-hsk30.js + enrich-vi-ipa.py)
 * Ngoài: node_modules/hanzi-writer-data/{char}.json (thứ tự nét — devDependency build-only)
 *
 * Ghi:
 *   1. apps/web/public/legacy/js/zh-dict/hsk.json — TỪ ĐIỂN đầy đủ HSK 3.0
 *      schema docs/chinese_design.md §3: id, simplified, traditional, pinyin,
 *      pinyin_numeric, hsk_level, pos, meaning_en, meaning_vi, radical,
 *      classifier, frequency_rank, strokes (số nét mỗi chữ), senses[],
 *      example_sentences[] (từ data/raw/zh-examples.jsonl — fetch-zh-examples.js).
 *   2. apps/web/public/legacy/js/zh-dict/zh-strokes.json — {char: {s:[path], m:[median]}}
 *      dữ liệu thứ tự nét cho Luyện viết (Hanzi Writer) — chỉ các chữ của HSK.
 *
 * Cách chạy:
 *   node data/scripts/build-hsk30.js
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'data', 'raw', 'hsk30-dictionary.enriched.jsonl');
const SRC_EX = path.join(ROOT, 'data', 'raw', 'zh-examples.jsonl');
const OUT_DIR = path.join(ROOT, 'apps', 'web', 'public', 'legacy', 'js', 'zh-dict');
const HANZI_WRITER_DATA = path.join(ROOT, 'node_modules', 'hanzi-writer-data');
const OUT_HSK = path.join(OUT_DIR, 'hsk.json');
const OUT_STROKES = path.join(OUT_DIR, 'zh-strokes.json');

function loadChar(c) {
  try {
    return require(path.join(HANZI_WRITER_DATA, c + '.json'));
  } catch {
    return null;
  }
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('✗ Thiếu ' + SRC + ' — chạy: node data/scripts/fetch-hsk30.js + enrich.');
    process.exit(1);
  }

  // ---- đọc enriched: gom theo từ (1 từ → nhiều nghĩa) ----
  const byWord = new Map();
  const rl = readline.createInterface({ input: fs.createReadStream(SRC), crlfDelay: Infinity });
  let lines = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const w = String(e.word || '').trim();
    if (!w) continue;
    lines++;
    if (!byWord.has(w)) {
      byWord.set(w, { meta: e, senses: [] });
    }
    byWord.get(w).senses.push({
      pos: String(e.partOfSpeech || '').trim(),
      en: String(e.definition || '').trim(),
      vi: String(e.vi || '').trim(),
    });
  }
  rl.close();
  console.log(`📖 ${lines} dòng → ${byWord.size} từ.`);

  // ---- nét chữ: chỉ cần các chữ DUY NHẤT ----
  const chars = new Set();
  for (const w of byWord.keys()) for (const c of w) chars.add(c);
  console.log(`✍️  ${chars.size} chữ Hán duy nhất — trích nét (hanzi-writer-data)…`);
  const strokes = {};
  let miss = 0;
  for (const c of chars) {
    const d = loadChar(c);
    if (d && Array.isArray(d.strokes) && d.strokes.length) {
      strokes[c] = { s: d.strokes, m: d.medians || d.strokes.map(() => []) };
    } else {
      miss++;
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_STROKES, JSON.stringify(strokes), 'utf-8');
  console.log(`   ${Object.keys(strokes).length} chữ có nét (${miss} chữ không có — để trống).`);

  // ---- ví dụ câu (fetch-zh-examples.js) ----
  const exByWord = new Map();
  if (fs.existsSync(SRC_EX)) {
    for (const line of fs.readFileSync(SRC_EX, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line);
        if (o && o.word) exByWord.set(o.word, o.examples || []);
      } catch { /* bỏ qua */ }
    }
  }

  // ---- hsk.json theo schema thiết kế ----
  const words = [];
  for (const [w, { meta, senses }] of byWord) {
    const primary = senses[0] || { pos: '', en: '', vi: '' };
    words.push({
      id: 'hsk30_' + String(words.length + 1).padStart(6, '0'),
      simplified: w,
      traditional: String(meta.traditional || w),
      pinyin: String(meta.ipa || ''),
      pinyin_numeric: String(meta.pinyin_numeric || ''),
      hsk_level: typeof meta.level === 'number' ? meta.level : 0,
      pos: [...new Set(senses.map((s) => s.pos).filter(Boolean))].join(' / '),
      meaning_en: primary.en,
      meaning_vi: primary.vi,
      radical: String(meta.radical || ''),
      classifier: String(meta.classifier || ''),
      frequency_rank: typeof meta.freq === 'number' ? meta.freq : 0,
      strokes: [...w].map((c) => ({ c, n: strokes[c] ? strokes[c].s.length : 0 })),
      senses: senses.filter((s) => s.en || s.vi),
      example_sentences: (exByWord.get(w) || []).map((e) => ({
        zh: String(e.zh || ''),
        pinyin: String(e.pinyin || '').trim(),
        vi: String(e.vi || ''),
        en: String(e.en || ''),
      })),
    });
  }
  words.sort((a, b) => (a.hsk_level - b.hsk_level) || (b.frequency_rank - a.frequency_rank));
  fs.writeFileSync(OUT_HSK, JSON.stringify(words), 'utf-8');

  console.log(`\n✅ ${OUT_HSK} — ${words.length} từ`);
  console.log(`✅ ${OUT_STROKES} — ${Object.keys(strokes).length} chữ`);
  const byLevel = {};
  words.forEach((w) => { byLevel[w.hsk_level] = (byLevel[w.hsk_level] || 0) + 1; });
  console.log('   Theo cấp: ' + Object.entries(byLevel).map(([l, n]) => `HSK${l}=${n}`).join(' · '));
}

main().catch((err) => { console.error('✗', err.message); process.exit(1); });