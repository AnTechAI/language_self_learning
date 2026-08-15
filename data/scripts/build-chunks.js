/**
 * build-chunks.js — CHIA english-dictionary.jsonl (41MB) thành các CHUNK NHỎ
 * để app chỉ tải ĐÚNG 1 chunk chứa từ cần tra (truy xuất theo nhu cầu, offline).
 *
 * Cách hoạt động (2 lượt đọc để đảm bảo ánh xạ khớp loader):
 *   Lượt 1: đếm số entry hợp lệ → N = ceil(total / size)
 *   Lượt 2: bucket = hashWord(word) % N → mỗi bucket là 1 file chunk-NNN.js
 *   - Mỗi entry nén thành mảng: [word, pos, definition, example, syn[], ant[]]
 *   - Nếu file nguồn là bản LÀM GIÀU (data/scripts/enrich-vi-ipa.py — có trường vi/ipa)
 *     thì thêm 2 cột: [.., vi, ipa] → từ điển hiển thị nghĩa Việt + phiên âm
 *   - App (js/bank-loader.js) tra từ → chunkName = hash%N → chỉ tải 1 file đó
 *
 * Cách dùng:
 *   node data/scripts/cli.js chunks                # sinh lại toàn bộ js/bank/
 *   node data/scripts/cli.js chunks --size 3000    # số entry mỗi chunk (mặc định 2000)
 *   node data/scripts/cli.js chunks --src data/raw/english-dictionary.enriched.jsonl  # nguồn khác
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..', '..');
const JSONL_FILE = path.join(ROOT, 'data', 'raw', 'english-dictionary.jsonl');
const ENRICHED_FILE = path.join(ROOT, 'data', 'raw', 'english-dictionary.enriched.jsonl');
const OUT_DIR = path.join(ROOT, 'apps', 'web', 'public', 'legacy', 'js', 'bank');

const DEFAULT_SIZE = 2000;

/** Băm FNV-1a 32-bit — phải GIỐNG HỆT js/bank-loader.js */
function hashWord(w) {
  let h = 0x811c9dc5;
  for (let i = 0; i < w.length; i++) {
    h ^= w.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function compactRow(e) {
  const ex = Array.isArray(e.examples) ? (e.examples[0] || '') : (e.examples || '');
  const row = [String(e.word || '').toLowerCase(), String(e.partOfSpeech || ''), String(e.definition || ''), String(ex),
    Array.isArray(e.synonyms) ? e.synonyms.slice(0, 4) : [],
    Array.isArray(e.antonyms) ? e.antonyms.slice(0, 4) : []];
  if (e.vi || e.ipa) row.push(e.vi ? String(e.vi) : '', e.ipa ? String(e.ipa) : '');
  return row;
}

async function countEntries(file) {
  let total = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { const e = JSON.parse(line); if (e.word) total++; } catch (err) { /* bỏ dòng lỗi */ }
  }
  rl.close();
  return total;
}

(async () => {
  const argv = process.argv.slice(2);
  const sizeArg = argv.indexOf('--size');
  const size = parseInt(sizeArg >= 0 ? (argv[sizeArg + 1] || DEFAULT_SIZE) : DEFAULT_SIZE, 10) || DEFAULT_SIZE;
  const srcArg = argv.indexOf('--src');
  const srcFile = srcArg >= 0 ? path.resolve(ROOT, argv[srcArg + 1]) : '';
  // Ưu tiên file làm giàu (vi/ipa) nếu tồn tại; nếu không dùng file gốc
  let JSONL_FILE = srcFile || (fs.existsSync(ENRICHED_FILE) ? ENRICHED_FILE : path.join(ROOT, 'data', 'raw', 'english-dictionary.jsonl'));
  if (!fs.existsSync(JSONL_FILE)) { console.error('✗ Không tìm thấy ' + JSONL_FILE); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));

  console.log('📖 Lượt 1: đếm entry…');
  const total = await countEntries(JSONL_FILE);
  const N = Math.max(1, Math.ceil(total / size));
  console.log(`   ${total} entry → N = ${N} chunk (mỗi chunk ~${size}).`);
  const hasViIpa = !!(await firstLineHasViIpa(JSONL_FILE));

  console.log('📖 Lượt 2: phân bổ theo hash % ' + N + '…');
  const buckets = new Map();
  let rows = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(JSONL_FILE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch (err) { continue; }
    const word = String(e.word || '').toLowerCase();
    if (!word) continue;
    const b = hashWord(word) % N;
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(compactRow(e));
    rows++;
  }
  rl.close();

  console.log('✍️ Đang ghi ' + N + ' file…');
  const names = [];
  for (let b = 0; b < N; b++) {
    const name = 'chunk-' + String(b).padStart(3, '0') + '.js';
    names.push(name);
    const body = '(function(){window.VocabApp.bankRegister(' + JSON.stringify(name) + ',' + JSON.stringify(buckets.get(b) || []) + ');})();\n';
    fs.writeFileSync(path.join(OUT_DIR, name), body, 'utf-8');
  }
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.js'),
    '/* Từ điển ngoại tuyến — sinh bởi data/scripts/build-chunks.js (' + new Date().toISOString().slice(0, 10) + ') */\n' +
    'window.VocabApp.bankInit(' + JSON.stringify(names) + ');\n', 'utf-8');

  const totalBytes = names.reduce((s, n) => s + fs.statSync(path.join(OUT_DIR, n)).size, 0) + fs.statSync(path.join(OUT_DIR, 'manifest.js')).size;
  const maxChunk = Math.max(...names.map((n) => fs.statSync(path.join(OUT_DIR, n)).size));
  console.log(`✅ ${rows} entry → ${names.length} chunk (~${(totalBytes / 1048576).toFixed(1)}MB) tại js/bank/.`);
  console.log(`   Mỗi lần tra từ app chỉ tải ~${(maxChunk / 1024) | 0}KB (1 chunk).`);
  if (hasViIpa) console.log('   Nguồn: bản LÀM GIÀU (vi/ipa) — từ điển hiển thị nghĩa Việt + phiên âm.');
})();

/** Kiểm tra dòng đầu có chứa vi/ipa không (để báo cột mở rộng) */
async function firstLineHasViIpa(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    try {
      const e = JSON.parse(line);
      if (e.vi || e.ipa) return true;
      if (e.word) return false;
    } catch (err) { /* dòng lỗi */ }
  }
  return false;
}
