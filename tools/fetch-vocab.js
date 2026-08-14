/**
 * fetch-vocab.js — TỰ ĐỘNG NẠP TỪ VỰNG từ Internet.
 *
 * Luồng xử lý cho TỪNG từ:
 *   1) Free Dictionary API (https://api.dictionaryapi.dev) → IPA, loại từ,
 *      nghĩa tiếng Anh, ví dụ, đồng nghĩa, trái nghĩa.
 *   2) Google Translate (endpoint miễn phí) → dịch nghĩa sang tiếng Việt.
 *   3) Xuất ra đúng định dạng nén của SEED_WORDS trong js/seed-data.js.
 *
 * Cách dùng:
 *   node tools/fetch-vocab.js                     # đọc danh sách tools/new-words.txt
 *   node tools/fetch-vocab.js tools/words2.txt    # dùng danh sách khác
 *   node tools/fetch-vocab.js --words "gratitude curious brave"
 *   node tools/fetch-vocab.js --tag "cảm xúc"     # ghi đè chủ đề cho toàn bộ
 *   node tools/fetch-vocab.js --limit 30          # giới hạn số từ xử lý
 *   node tools/fetch-vocab.js --apply             # TỰ CHÈN vào js/seed-data.js
 *   node tools/fetch-vocab.js --fixpos            # chỉ sửa loại từ (không thêm mới)
 *   node tools/fetch-vocab.js --enrich            # THÊM NGHĨA cho từ đã có (đa nghĩa)
 *   node tools/fetch-vocab.js --enrich --words "present run"
 *
 * Từ mới lấy về sẽ kèm CÁC NGHĨA BỔ SUNG (tối đa 3) — ví dụ present có
 * verb + noun + adjective. Chạy --enrich để bổ sung nghĩa cho các từ đã có
 * (chỉ thêm, không ghi đè; app tự nâng cấp dữ liệu cũ qua settings.seedVersion).
 *
 * Kết quả luôn lưu vào tools/out/ (vocab-batch.json + vocab-batch.js).
 * Không có --apply thì KHÔNG sửa file app — bạn xem trước rồi mới chèn.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SEED_FILE = path.join(ROOT, 'apps', 'web', 'public', 'legacy', 'js', 'seed-data.js');
const OUT_DIR = path.join(__dirname, 'out');

const API_DICT = (w) => `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`;
const API_TRANS = (q) => `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(q)}`;

const DELAY_MS = 500;     // giãn cách giữa các request (tránh chặn)
const ENRICH_DELAY = 1200; // enrich chạy dài → giãn rộng hơn
const MAX_RETRY = 3;

/* ---------- tiện ích ---------- */
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getJSON(url, retry = MAX_RETRY) {
  for (let i = 0; i < retry; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (vocab-fetcher)' } });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      if (r.status === 429) { console.log('    ⏳ bị giới hạn tốc độ, chờ ' + (2000 * (i + 1) / 1000) + 's…'); await sleep(2000 * (i + 1)); continue; }
    } catch (e) { /* lỗi mạng → thử lại */ }
    await sleep(DELAY_MS * 2);
  }
  return null;
}

/** Làm sạch đoạn EN (định nghĩa / ví dụ): lấy 1-2 câu đầu, giới hạn độ dài */
function cleanEN(s, max) {
  s = String(s || '').replace(/\s+/g, ' ').trim().replace(/[\s:,;—-]+$/, '');
  if (!s) return '';
  const sentences = s.split(/(?<=\.)\s+/).slice(0, 2).join(' ');
  if (sentences.length > max) return sentences.slice(0, max).replace(/\s+[^\s]*$/, '') + '…';
  return sentences;
}

/** Lọc đồng nghĩa/trái nghĩa: bỏ trùng, bỏ cụm lạ, bỏ từ trùng với chính nó */
function cleanList(list, word) {
  const seen = new Set();
  return (list || [])
    .map((s) => String(s).trim())
    .filter((s) => s && s.toLowerCase() !== word.toLowerCase())
    .filter((s) => /^[a-z][a-z '.-]*$/i.test(s))
    .filter((s) => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 4);
}

/** Google Translate 1 đoạn EN → VI */
async function translate(text) {
  if (!text) return '';
  const data = await getJSON(API_TRANS(text));
  if (!data || !Array.isArray(data[0])) return '';
  return data[0].map((seg) => (seg && seg[0]) || '').join('').trim();
}

/** Làm sạch nghĩa tiếng Việt: bỏ ngoặc thừa, thêm dấu chấm cuối */
function cleanVI(s) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\(\["“']+|[\)\]"”',.]+$/g, '').trim();
  if (!s) return '';
  if (!/[.!?。]$/.test(s)) s += '.';
  return s;
}

/** Chuẩn hóa loại từ về 1 trong các giá trị app đang dùng (so khớp theo token, tránh nhầm 'adverb'→'verb') */
function normPOS(p) {
  const tokens = String(p || '').toLowerCase().split(/[^a-z]/).filter(Boolean);
  for (const t of tokens) {
    if (t === 'adverb') return 'adverb';
    if (t === 'verb') return 'verb';
    if (t === 'adjective') return 'adjective';
    if (t === 'pronoun') return 'pronoun';
    if (t === 'preposition') return 'preposition';
    if (t === 'conjunction') return 'conjunction';
    if (t === 'interjection' || t === 'exclamation') return 'interjection';
    if (t === 'noun') return 'noun';
  }
  return 'other';
}

/**
 * Chọn LOẠI TỪ CHÍNH của từ. API dictionaryapi.dev sắp xếp meanings theo thứ tự
 * kỳ lạ (noun thường đứng ĐẦU kể cả với từ thuần động từ như carry/give), nên
 * chọn POS có NHIỀU NGHĨA (definitions) nhất — đây là cách đoán tần suất tốt.
 * Hòa nhau thì ưu tiên: verb > noun > adjective > adverb > …
 */
const POS_PRIORITY = ['verb', 'noun', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'interjection', 'other'];
// Ghi đè thủ công cho từ mà heuristic chọn chưa đúng ý người học
const POS_OVERRIDE = {
  kind: 'adjective',     // tốt bụng (không phải "loại")
  lead: 'verb',          // dẫn dắt (không phải "chì")
  still: 'adverb',       // vẫn
  again: 'adverb',       // lại, một lần nữa
  maybe: 'adverb',       // có lẽ
  perhaps: 'adverb',     // có lẽ
  fast: 'adjective',     // nhanh
  answer: 'verb',        // trả lời
  hope: 'verb',          // hy vọng
  wish: 'verb',          // ước mong
  wonder: 'verb',        // tự hỏi
  try: 'verb',           // cố gắng
  often: 'adverb',       // thường
  because: 'conjunction', // bởi vì
  without: 'preposition', // không có
  toward: 'preposition',  // về phía
  inside: 'preposition',  // bên trong
  outside: 'preposition', // bên ngoài
  above: 'preposition',   // phía trên
  below: 'preposition',   // phía dưới
  exit: 'noun',           // lối ra
  price: 'noun',          // giá cả
  catch: 'verb',          // bắt, chộp
  save: 'verb',           // tiết kiệm
  reply: 'verb',          // hồi đáp
  watch: 'verb',          // xem, quan sát
  hold: 'verb',           // giữ, cầm
  need: 'verb',           // cần
  lend: 'verb',           // cho mượn
  share: 'verb',          // chia sẻ
  enter: 'verb',          // đi vào
  brave: 'adjective',     // can đảm
  fly: 'verb',            // bay
};
function pickPOS(meanings) {
  const counts = {};
  (meanings || []).forEach((m) => {
    const p = normPOS(m.partOfSpeech);
    counts[p] = (counts[p] || 0) + Math.max((m.definitions || []).length, 1);
  });
  let best = 'other', bestN = -1;
  for (const p of Object.keys(counts)) {
    const n = counts[p];
    if (n > bestN || (n === bestN && POS_PRIORITY.indexOf(p) < POS_PRIORITY.indexOf(best))) {
      best = p; bestN = n;
    }
  }
  return best;
}

/* ---------- đọc danh sách từ ---------- */
function parseArgs() {
  const a = process.argv.slice(2);
  const opt = { file: path.join(__dirname, 'new-words.txt'), tag: '', limit: 0, apply: false, words: [], fixpos: false, enrich: false };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--apply') opt.apply = true;
    else if (a[i] === '--fixpos') opt.fixpos = true;
    else if (a[i] === '--enrich') opt.enrich = true;
    else if (a[i] === '--tag') { opt.tag = a[i + 1] || ''; i++; }
    else if (a[i] === '--limit') { opt.limit = parseInt(a[i + 1], 10) || 0; i++; }
    else if (a[i] === '--words') { opt.words = (a[i + 1] || '').split(/\s+/).filter(Boolean); i++; }
    else if (!a[i].startsWith('--')) opt.file = a[i];
  }
  return opt;
}

function readWordList(file) {
  if (!fs.existsSync(file)) {
    console.error('✗ Không tìm thấy file danh sách:', file);
    process.exit(1);
  }
  const items = [];
  let tag = '';
  fs.readFileSync(file, 'utf-8').split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    if (t.startsWith('@')) { tag = t.slice(1).trim(); return; } // @chủ đề áp dụng cho các dòng sau
    const parts = t.split(',').map((s) => s.trim());
    const word = parts[0].toLowerCase();
    if (/^[a-z][a-z' -]*$/.test(word)) items.push({ word, tag: parts[1] || tag || 'đời sống' });
  });
  return items;
}

/* ---------- lấy dữ liệu từ API cho 1 từ ---------- */

/**
 * Gộp các NGHĨA BỔ SUNG (loại từ khác / nghĩa khác) từ API.
 * Trả về mảng object dạng nén: {p, i, e, v, x, s, a} — tối đa MAX_EXTRAS nghĩa.
 */
const MAX_EXTRAS = 3;
const EXTRAS_ALLOWED = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction'];

async function buildExtras(word, entry, skipPos, skipDef) {
  const meanings = entry.meanings || [];
  const ipa = (entry.phonetics || []).map((p) => p.text || '').find((t) => t) || '';
  const extras = [];
  const seenPos = new Set(skipPos || []);
  const seenDef = new Set(skipDef || []);
  for (const mm of meanings) {
    const p = normPOS(mm.partOfSpeech);
    if (!EXTRAS_ALLOWED.includes(p) || seenPos.has(p)) continue;
    const d0 = (mm.definitions || [])[0] || {};
    const de = cleanEN(d0.definition, 150);
    const key = de.toLowerCase();
    if (!de || seenDef.has(key)) continue;
    // Dịch định nghĩa của NGHĨA ĐÓ để ra bản dịch đúng ngữ cảnh (vd present (verb) ≠ present (noun))
    let dv = cleanVI(await translate(d0.definition || word)).slice(0, 140);
    if (!dv || dv.length > 150 || dv.toLowerCase().replace(/[^a-z]/g, '') === word.toLowerCase()) {
      dv = cleanVI(await translate(word)).slice(0, 140);
    }
    if (!dv) continue;
    seenPos.add(p);
    seenDef.add(key);
    extras.push({
      p, i: ipa,
      e: de, v: dv,
      x: cleanEN(d0.example || '', 120),
      s: cleanList(mm.synonyms, word),
      a: cleanList(mm.antonyms, word),
    });
    if (extras.length >= MAX_EXTRAS) break;
  }
  return extras;
}

async function fetchWord({ word, tag }) {
  const data = await getJSON(API_DICT(word));
  if (!data || !data.length) return { word, tag, ok: false, reason: 'không tìm thấy trong từ điển' };

  const e = data[0];
  const ipa = (e.phonetics || []).map((p) => p.text || '').find((t) => t) || '';
  const meanings = e.meanings || [];
  const pos = POS_OVERRIDE[word] || pickPOS(meanings);
  const meaning = meanings.find((m) => normPOS(m.partOfSpeech) === pos) || meanings[0] || {};
  const def = (meaning.definitions || [])[0] || {};
  const defEN = cleanEN(def.definition, 170);
  const example = cleanEN((def.example || '').trim() || (meaning.definitions || []).map((d) => d.example || '').find((x) => x) || '', 130);
  const synonyms = cleanList(meaning.synonyms, word);
  const antonyms = cleanList(meaning.antonyms, word);

  if (!defEN) return { word, tag, ok: false, reason: 'không có định nghĩa' };

  // Dịch sang tiếng Việt: ưu tiên dịch từ đơn; nếu kết quả kém thì dịch cả định nghĩa
  let defVI = cleanVI(await translate(word));
  if (!defVI || defVI.length > 50 || defVI.toLowerCase().replace(/[^a-z]/g, '') === word.toLowerCase()) {
    defVI = cleanVI(await translate(defEN)).slice(0, 160);
  }

  // Các nghĩa bổ sung (loại từ khác / nghĩa khác) — đa nghĩa
  const extras = await buildExtras(word, e, [pos], [defEN.toLowerCase()]);

  return { word, tag, ok: true, ipa, pos, defEN, defVI, example, synonyms, antonyms, extras };
}

/* ---------- sinh dòng nén SEED_WORDS ---------- */
function escSQ(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

/** 1 object nghĩa bổ sung → literal {p:'...', i:'...', ...} */
function fmtExtra(x) {
  const parts = [];
  if (x.p) parts.push(`p:'${escSQ(x.p)}'`);
  if (x.i) parts.push(`i:'${escSQ(x.i)}'`);
  if (x.e) parts.push(`e:'${escSQ(x.e)}'`);
  if (x.v) parts.push(`v:'${escSQ(x.v)}'`);
  if (x.x) parts.push(`x:'${escSQ(x.x)}'`);
  if (x.s && x.s.length) parts.push('s:' + JSON.stringify(x.s));
  if (x.a && x.a.length) parts.push('a:' + JSON.stringify(x.a));
  return '{' + parts.join(', ') + '}';
}

function toRow(r) {
  const head = [r.word, r.ipa, r.pos, r.defEN, r.defVI, r.example, r.tag, r.synonyms, r.antonyms];
  const extras = (r.extras || []).map(fmtExtra);
  return '  [' + head.map((x) => JSON.stringify(x)).join(', ') + (extras.length ? ', ' + extras.join(', ') : '') + '],';
}

/* ---------- đọc các từ đã có trong SEED_WORDS (tránh trùng) ---------- */
function existingSeedWords() {
  const src = fs.readFileSync(SEED_FILE, 'utf-8');
  const start = src.indexOf('const SEED_WORDS = [');
  const end = src.indexOf('];', start);
  const block = src.slice(start, end);
  return new Set([...block.matchAll(/^\s*\[\s*['"]([^'"]+)['"]/gm)].map((m) => m[1].toLowerCase()));
}

/** Vị trí dấu ] đóng SEED_WORDS: tìm dòng đầu tiên là "];" sau điểm bắt đầu
    (không dùng bộ đếm ngoặc vì trong khối có comment chứa [ ] ' " phá nhịp) */
function findSeedEnd(src) {
  const start = src.indexOf('const SEED_WORDS = [');
  const tail = src.slice(start);
  const m = tail.match(/^[ \t]*\];[ \t]*(?:\r?\n|$)/m);
  return m ? start + m.index + m[0].indexOf('];') : -1;
}

/**
 * --fixpos: đọc tools/out/vocab-batch.json (dữ liệu đã lấy), kiểm tra lại POS
 * từ API rồi SỬA TRỰC TIẾP trong js/seed-data.js (không thêm từ mới).
 */
async function fixPOS() {
  const json = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'vocab-batch.json'), 'utf-8'));
  const lines = fs.readFileSync(SEED_FILE, 'utf-8').split(/\r?\n/);
  let fixed = 0, checked = 0;
  for (const row of json.rows) {
    const data = await getJSON(API_DICT(row.word));
    checked++;
    // Ưu tiên bảng ghi đè thủ công — áp dụng được kể cả khi API lỗi/lệch
    let pos = POS_OVERRIDE[row.word];
    if (!pos && data && data.length) pos = pickPOS(data[0].meanings || []);
    if (!pos) continue;
    for (let li = 0; li < lines.length; li++) {
      const m = lines[li].match(/^\s*\[(["'])([^"']+)\1\s*,\s*/);
      if (!m || m[2].toLowerCase() !== row.word) continue;
      const arr = Function('return ' + lines[li].replace(/,\s*$/, ''))();
      if (arr[2] !== pos) {
        arr[2] = pos;
        lines[li] = '  [' + arr.map((x) => JSON.stringify(x)).join(', ') + '],';
        fixed++;
      }
      break;
    }
    await sleep(DELAY_MS / 2);
  }
  fs.writeFileSync(SEED_FILE, lines.join('\r\n'), 'utf-8');
  const { execSync } = require('child_process');
  execSync('node --check ' + JSON.stringify(SEED_FILE));
  console.log(`✅ Đã kiểm tra ${checked} từ, sửa POS cho ${fixed} từ (js/seed-data.js, node --check OK).`);
}

/**
 * --enrich: BỔ SUNG NGHĨA (đa nghĩa / nhiều loại từ) cho các từ ĐÃ CÓ trong
 * SEED_WORDS — giữ nguyên 10 phần tử đầu (word/ipa/pos/… đã chỉnh tay),
 * chỉ thêm object nghĩa bổ sung vào cuối dòng. Ghi file định kỳ để dừng
 * giữa chừng không mất tiến độ (chạy lại sẽ bỏ qua từ đã có nghĩa bổ sung).
 * Dùng: node tools/fetch-vocab.js --enrich [--words "present light run"]
 */
async function enrich() {
  const opt = parseArgs();
  const src = fs.readFileSync(SEED_FILE, 'utf-8');
  const endPos = findSeedEnd(src);
  if (endPos < 0) { console.error('✗ Không tìm thấy cuối mảng SEED_WORDS.'); return; }
  const lines = src.split(/\r?\n/);
  const startLine = src.slice(0, src.indexOf('const SEED_WORDS = [')).split(/\r?\n/).length - 1;
  const endLine = src.slice(0, endPos).split(/\r?\n/).length - 1;
  const only = new Set((opt.words || []).map((w) => w.toLowerCase()));
  let done = 0, enriched = 0, skipped = 0;
  for (let li = startLine; li <= endLine; li++) {
    const m = lines[li].match(/^\s*\[(["'])([^"']+)\1\s*,\s*/);
    if (!m) continue;
    const word = m[2].toLowerCase();
    if (word === 'record') continue;                 // đã đa nghĩa thủ công
    if (only.size && !only.has(word)) continue;      // lọc theo --words
    let arr;
    try { arr = Function('return ' + lines[li].replace(/,\s*$/, ''))(); } catch (e) { continue; }
    if (arr.length > 10) { skipped++; continue; }    // đã có nghĩa bổ sung
    const data = await getJSON(API_DICT(word));
    done++;
    if (!data || !data.length) continue;
    const extras = await buildExtras(word, data[0], [arr[2]], [String(arr[3] || '').toLowerCase()]);
    if (!extras.length) continue;
    const head = arr.slice(0, 10);
    lines[li] = '  [' + head.map((x) => JSON.stringify(x)).join(', ') + (extras.length ? ', ' + extras.map(fmtExtra).join(', ') : '') + '],';
    enriched++;
    if (enriched % 20 === 0) fs.writeFileSync(SEED_FILE, lines.join('\r\n'), 'utf-8'); // lưu tiến độ
    if (opt.limit > 0 && enriched >= opt.limit) break;
    await sleep(ENRICH_DELAY);
  }
  fs.writeFileSync(SEED_FILE, lines.join('\r\n'), 'utf-8');
  const { execSync } = require('child_process');
  execSync('node --check ' + JSON.stringify(SEED_FILE));
  console.log(`✅ Đã thêm nghĩa bổ sung cho ${enriched} từ (đã kiểm ${done}, bỏ qua ${skipped} từ đã đa nghĩa) — node --check OK.`);
}

/* ---------- chính ---------- */
(async () => {
  const opt = parseArgs();
  if (opt.fixpos) { await fixPOS(); return; }
  if (opt.enrich) { await enrich(); return; }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let items = opt.words.map((w) => ({ word: w.toLowerCase(), tag: opt.tag || 'đời sống' }));
  if (!items.length) items = readWordList(opt.file);
  if (opt.tag) items.forEach((it) => (it.tag = opt.tag));
  if (opt.limit > 0) items = items.slice(0, opt.limit);

  const existing = existingSeedWords();
  const todo = items.filter((it) => !existing.has(it.word));
  const dupes = items.length - todo.length;
  if (dupes) console.log(`⏭️ Bỏ ${dupes} từ đã có trong kho.`);

  console.log(`🔍 Đang lấy ${todo.length} từ (mỗi từ ~2 request: từ điển + dịch)…\n`);
  const rows = [], skipped = [];
  for (let i = 0; i < todo.length; i++) {
    const it = todo[i];
    const r = await fetchWord(it);
    if (r.ok) {
      rows.push(r);
      console.log(`  ✓ [${i + 1}/${todo.length}] ${r.word}  (${r.pos})  → ${r.defVI}`);
    } else {
      skipped.push(r);
      console.log(`  ✗ [${i + 1}/${todo.length}] ${r.word}  — ${r.reason}`);
    }
    await sleep(DELAY_MS);
  }

  // Lưu kết quả
  const stamp = new Date().toISOString().slice(0, 10);
  const json = { fetchedAt: stamp, rows, skipped };
  fs.writeFileSync(path.join(OUT_DIR, 'vocab-batch.json'), JSON.stringify(json, null, 2), 'utf-8');

  const jsOut = `/* TỪ VỰNG SINH TỰ ĐỘNG (${stamp}) — bởi tools/fetch-vocab.js.
   Chèn khối dưới đây vào mảng SEED_WORDS trong js/seed-data.js
   (hoặc dùng: node tools/fetch-vocab.js --apply) */
  // ── batch: ${stamp} ──\n${rows.map(toRow).join('\n')}\n`;
  fs.writeFileSync(path.join(OUT_DIR, 'vocab-batch.js'), jsOut, 'utf-8');

  console.log(`\n📦 Xong: ${rows.length} từ OK, ${skipped.length} từ lỗi, ${dupes} từ trùng.`);
  console.log(`   Kết quả thô: tools/out/vocab-batch.json`);
  console.log(`   Dạng nén sẵn: tools/out/vocab-batch.js`);

  if (opt.apply && rows.length) {
    const src = fs.readFileSync(SEED_FILE, 'utf-8');
    const end = findSeedEnd(src);
    if (end < 0) { console.error('✗ Không tìm thấy cuối mảng SEED_WORDS — chèn tay qua vocab-batch.js.'); process.exit(1); }
    const newRows = rows.map(toRow).join('\n');
    const out = src.slice(0, end) + `\n  // ── batch: ${stamp} (tools/fetch-vocab.js) ──\n${newRows}\n` + src.slice(end);
    fs.writeFileSync(SEED_FILE, out, 'utf-8');
    const { execSync } = require('child_process');
    try { execSync('node --check ' + JSON.stringify(SEED_FILE)); console.log(`✅ Đã chèn ${rows.length} từ vào js/seed-data.js (node --check OK).`); }
    catch (e) { console.error('✗ node --check THẤT BẠI — file seed bị lỗi, kiểm tra lại!'); console.error(e.message); process.exit(1); }
  } else if (opt.apply && !rows.length) {
    console.log('ℹ️ Không có từ mới để chèn (tất cả đã có hoặc bị lỗi).');
  } else {
    console.log('ℹ️ Chưa sửa file app. Muốn tự chèn chạy thêm: node tools/fetch-vocab.js --apply');
  }
})();
