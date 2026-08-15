/**
 * build-from-jsonl.js — DỰNG TỪ VỰNG từ file english-dictionary.jsonl của bạn.
 *
 * Nguồn dữ liệu (mỗi dòng 1 JSON):
 *   {"word": "...", "partOfSpeech": "noun", "definition": "...",
 *    "examples": [...], "synonyms": [...], "antonyms": [...]}
 *
 * Tool sẽ VỚI TỪNG từ:
 *   1) Gom MỌI dòng của từ đó thành CÁC NGHĨA (đa loại từ / đa nghĩa).
 *   2) Dịch định nghĩa sang tiếng Việt (Google Translate, miễn phí).
 *   3) Lấy PHIÊN ÂM (IPA) từ Free Dictionary API.
 *   4) Xuất ra đúng định dạng nén của SEED_WORDS trong js/seed-data.js
 *      (kèm nghĩa bổ sung {p,i,e,v,x,s,a} — xem header seed-data.js).
 *
 * Cách dùng:
 *   node data/scripts/cli.js build --words "gratitude brave polite"
 *   node data/scripts/cli.js build --file danh-sach-tu.txt        # 1 từ mỗi dòng:  từ, chủ đề
 *   node data/scripts/cli.js build --limit 100 --tag "đời sống"   # 100 từ đơn đầu tiên trong file
 *   node data/scripts/cli.js build ... --max-senses 6             # giới hạn số nghĩa/từ
 *   node data/scripts/cli.js build ... --apply                    # TỰ CHÈN vào js/seed-data.js
 *   node data/scripts/cli.js build ... --phrases                  # cho phép cả cụm nhiều từ
 *   node data/scripts/cli.js build ... --allow-no-ipa             # chấp nhận từ không có phiên âm
 *
 * Mặc định chỉ lấy TỪ ĐƠN + BẮT BUỘC có phiên âm (đúng quy ước app), bỏ qua
 * từ đã có trong kho. Xem trước ở data/scripts/out/jsonl-rows.js trước khi --apply.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED_FILE = path.join(ROOT, 'apps', 'web', 'public', 'legacy', 'js', 'seed-data.js');
const JSONL_FILE = path.join(ROOT, 'data', 'raw', 'english-dictionary.jsonl');
const OUT_DIR = path.join(__dirname, 'out');

const API_DICT = (w) => `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`;
const API_TRANS = (q) => `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(q)}`;
const DELAY_MS = 600;
const MAX_RETRY = 3;

/* ================= tiện ích ================= */
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getJSON(url, retry = MAX_RETRY) {
  for (let i = 0; i < retry; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (vocab-fetcher)' } });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      if (r.status === 429) { console.log('    ⏳ rate-limit, chờ ' + (2 * (i + 1)) + 's…'); await sleep(2000 * (i + 1)); continue; }
    } catch (e) { /* mạng lỗi → thử lại */ }
    await sleep(DELAY_MS * 2);
  }
  return null;
}

async function translate(q) {
  if (!q) return '';
  const data = await getJSON(API_TRANS(q));
  if (!data || !Array.isArray(data[0])) return '';
  return data[0].map((seg) => (seg && seg[0]) || '').join('').trim();
}

function cleanVI(s) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\(\["“']+|[\)\]"”',.]+$/g, '').trim();
  if (!s) return '';
  if (!/[.!?。]$/.test(s)) s += '.';
  return s;
}

function cleanEN(s, max) {
  s = String(s || '').replace(/\s+/g, ' ').trim().replace(/[\s:,;—-]+$/, '');
  if (!s) return '';
  s = s[0].toUpperCase() + s.slice(1); // viết hoa chữ đầu (nguồn JSONL viết thường)
  const sentences = s.split(/(?<=\.)\s+/).slice(0, 2).join(' ');
  if (sentences.length > max) return sentences.slice(0, max).replace(/\s+[^\s]*$/, '') + '…';
  return sentences;
}

function cleanList(list, word) {
  const seen = new Set();
  return (list || [])
    .map((s) => String(s).trim())
    .filter((s) => s && s.toLowerCase() !== word.toLowerCase())
    .filter((s) => /^[a-z][a-z '.-]*$/i.test(s))
    .filter((s) => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 4);
}

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

const POS_PRIORITY = ['verb', 'noun', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'interjection', 'other'];

/* ================= đọc JSONL ================= */
async function loadJsonlEntries(wordsSet) {
  const map = new Map();
  const rl = readline.createInterface({ input: fs.createReadStream(JSONL_FILE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    const w = e.word.toLowerCase();
    if (wordsSet.has(w)) {
      if (!map.has(w)) map.set(w, []);
      map.get(w).push(e);
    }
  }
  return map;
}

/* ================= dựng 1 từ ================= */
async function buildWord(word, entries, opt) {
  // 1) Gom senses từ JSONL (bỏ trùng định nghĩa, chuẩn hóa loại từ)
  const rawSenses = [];
  const seenDef = new Set();
  for (const e of entries) {
    const def = cleanEN(e.definition, 170);
    if (!def || seenDef.has(def.toLowerCase())) continue;
    seenDef.add(def.toLowerCase());
    rawSenses.push({
      p: normPOS(e.partOfSpeech),
      e: def,
      x: cleanEN(Array.isArray(e.examples) ? (e.examples[0] || '') : (e.examples || ''), 120),
      s: cleanList(e.synonyms, word),
      a: cleanList(e.antonyms, word),
    });
  }
  if (!rawSenses.length) return { word, ok: false, reason: 'không có định nghĩa' };

  // 2) Nghĩa CHÍNH = loại từ xuất hiện nhiều nhất (hòa thì verb > noun > adj…)
  //    Trong cùng loại từ, ưu tiên nghĩa NGẮN nhất — định nghĩa ngắn thường là nghĩa cốt lõi
  const byPos = {};
  rawSenses.forEach((s) => { byPos[s.p] = (byPos[s.p] || 0) + 1; });
  let primaryPos = 'other', best = -1;
  for (const p of Object.keys(byPos)) {
    if (byPos[p] > best || (byPos[p] === best && POS_PRIORITY.indexOf(p) < POS_PRIORITY.indexOf(primaryPos))) {
      primaryPos = p; best = byPos[p];
    }
  }
  const samePos = rawSenses.filter((s) => s.p === primaryPos);
  samePos.sort((a, b) => a.e.length - b.e.length);
  const primary = samePos[0];
  const extras = rawSenses.filter((s) => s !== primary).slice(0, opt.maxSenses - 1);

  // 3) Phiên âm IPA từ API (chỉ từ đơn; từ có dấu cách thì bỏ trống)
  let ipa = '';
  if (/^[a-z]+(?:['-][a-z]+)*$/i.test(word)) {
    const d = await getJSON(API_DICT(word));
    if (d && d.length) ipa = (d[0].phonetics || []).map((p) => p.text || '').find((t) => t) || '';
  }
  if (!ipa && !opt.allowNoIpa) return { word, ok: false, reason: 'không có phiên âm (API) — dùng --allow-no-ipa để giữ' };

  // 4) Dịch nghĩa tiếng Việt (cache theo văn bản để đỡ tốn request)
  const viCache = new Map();
  const wordVI = cleanVI(await translate(word));
  viCache.set('__word__', wordVI);
  async function viFor(sense) {
    if (viCache.has(sense.e)) return viCache.get(sense.e);
    let v = cleanVI(await translate(sense.e)).slice(0, 130);
    if (!v || v.length > 140 || v.toLowerCase().replace(/[^a-z]/g, '') === word.toLowerCase()) {
      v = wordVI || '';
    }
    viCache.set(sense.e, v);
    return v;
  }

  let primaryVI = wordVI;
  if (!primaryVI || primaryVI.length > 50 || primaryVI.toLowerCase().replace(/[^a-z]/g, '') === word.toLowerCase()) {
    primaryVI = await viFor(primary);
  }
  if (!primaryVI) return { word, ok: false, reason: 'không dịch được nghĩa' };

  // 5) Dựng dòng nén
  const extraObjs = [];
  for (const x of extras) {
    const v = await viFor(x);
    if (!v) continue;
    extraObjs.push({ p: x.p, i: ipa, e: x.e, v, x: x.x, s: x.s, a: x.a });
  }
  return {
    word, tag: opt.tag || 'đời sống', ok: true,
    row: [word, ipa, primary.p, primary.e, primaryVI, primary.x || '', opt.tag || 'đời sống', primary.s, primary.a, '', ...extraObjs],
  };
}

/* ================= in dòng / chèn file ================= */
function escSQ(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
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
  const head = r.row.slice(0, 10);
  const extras = r.row.slice(10).map(fmtExtra);
  return '  [' + head.map((x) => JSON.stringify(x)).join(', ') + (extras.length ? ', ' + extras.join(', ') : '') + '],';
}
function existingSeedWords() {
  const src = fs.readFileSync(SEED_FILE, 'utf-8');
  const start = src.indexOf('const SEED_WORDS = [');
  const end = src.indexOf('];', start);
  const block = src.slice(start, end);
  return new Set([...block.matchAll(/^\s*\[\s*['"]([^'"]+)['"]/gm)].map((m) => m[1].toLowerCase()));
}
function findSeedEnd(src) {
  const start = src.indexOf('const SEED_WORDS = [');
  const tail = src.slice(start);
  const m = tail.match(/^[ \t]*\];[ \t]*(?:\r?\n|$)/m);
  return m ? start + m.index + m[0].indexOf('];') : -1;
}

/* ================= chính ================= */
function parseArgs() {
  const a = process.argv.slice(2);
  const opt = { words: [], file: '', limit: 0, tag: '', apply: false, phrases: false, allowNoIpa: false, maxSenses: 5 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--apply') opt.apply = true;
    else if (a[i] === '--phrases') opt.phrases = true;
    else if (a[i] === '--allow-no-ipa') opt.allowNoIpa = true;
    else if (a[i] === '--tag') { opt.tag = a[i + 1] || ''; i++; }
    else if (a[i] === '--limit') { opt.limit = parseInt(a[i + 1], 10) || 0; i++; }
    else if (a[i] === '--max-senses') { opt.maxSenses = parseInt(a[i + 1], 10) || 5; i++; }
    else if (a[i] === '--words') { opt.words = (a[i + 1] || '').split(/\s+/).filter(Boolean); i++; }
    else if (a[i] === '--file') { opt.file = a[i + 1] || ''; i++; }
  }
  return opt;
}

(async () => {
  const opt = parseArgs();
  if (!fs.existsSync(JSONL_FILE)) { console.error('✗ Không tìm thấy ' + JSONL_FILE); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // --- Xác định danh sách từ cần dựng (mỗi mục: {word, tag}) ---
  let want = [];
  if (opt.words.length) want = opt.words.map((w) => ({ word: w.toLowerCase(), tag: opt.tag || 'đời sống' }));
  else if (opt.file) {
    let curTag = opt.tag || 'đời sống';
    fs.readFileSync(opt.file, 'utf-8').split(/\r?\n/).forEach((line) => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      if (t.startsWith('@')) { curTag = t.slice(1).trim() || curTag; return; }
      const parts = t.split(',').map((s) => s.trim());
      want.push({ word: parts[0].toLowerCase(), tag: parts[1] || curTag });
    });
  } else if (opt.limit > 0) {
    // Lấy N từ ĐƠN đầu tiên trong file JSONL
    const rl = readline.createInterface({ input: fs.createReadStream(JSONL_FILE), crlfDelay: Infinity });
    const single = new Set();
    for await (const line of rl) {
      if (want.length >= opt.limit) break;
      if (!line.trim()) continue;
      const e = JSON.parse(line);
      const w = e.word.toLowerCase();
      if (/^[a-z]+(?:['-][a-z]+)*$/i.test(w) && !single.has(w)) { single.add(w); want.push({ word: w, tag: opt.tag || 'đời sống' }); }
    }
    rl.close();
  }
  if (!want.length) { console.error('✗ Cho biết danh sách: --words "…" / --file list.txt / --limit N'); process.exit(1); }

  const existing = existingSeedWords();
  const todo = want.filter((it) => !existing.has(it.word));
  const dupes = want.length - todo.length;
  if (dupes) console.log(`⏭️ Bỏ ${dupes} từ đã có trong kho.`);
  if (!todo.length) { console.log('ℹ️ Không có từ mới để dựng.'); process.exit(0); }

  // --- Đọc JSONL cho đúng các từ cần ---
  console.log(`📖 Đang đọc english-dictionary.jsonl (lọc ${todo.length} từ)…`);
  const map = await loadJsonlEntries(new Set(todo.map((it) => it.word)));
  const missing = todo.filter((it) => !map.has(it.word)).map((it) => it.word);
  if (missing.length) console.log(`⚠️ ${missing.length} từ không có trong JSONL: ${missing.slice(0, 10).join(', ')}…`);

  // --- Dựng từng từ ---
  console.log(`🔨 Đang dựng ${todo.length - missing.length} từ (dịch Việt + phiên âm API)…\n`);
  const rows = [], skipped = [];
  for (let i = 0; i < todo.length; i++) {
    const it = todo[i];
    const w = it.word;
    if (!map.has(w)) { skipped.push({ word: w, reason: 'không có trong JSONL' }); continue; }
    const r = await buildWord(w, map.get(w), { ...opt, tag: it.tag });
    if (r.ok) {
      rows.push(r);
      const nSense = r.row.length > 10 ? r.row.length - 9 : 1;
      console.log(`  ✓ [${i + 1}/${todo.length}] ${w}  (${r.row[2]}${nSense > 1 ? ' +' + (nSense - 1) + ' nghĩa' : ''})  → ${r.row[4]}`);
    } else {
      skipped.push({ word: w, reason: r.reason });
      console.log(`  ✗ [${i + 1}/${todo.length}] ${w}  — ${r.reason}`);
    }
    await sleep(DELAY_MS);
  }

  // --- Xuất kết quả ---
  const stamp = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(OUT_DIR, 'jsonl-rows.json'), JSON.stringify({ fetchedAt: stamp, rows: rows.map((r) => ({ word: r.row[0], row: r.row, tag: r.tag })), skipped }, null, 2), 'utf-8');
  const jsOut = `/* TỪ VỰNG DỰNG TỪ english-dictionary.jsonl (${stamp}) — bởi data/scripts/build-from-jsonl.js.
   Chèn khối dưới đây vào mảng SEED_WORDS trong js/seed-data.js
   (hoặc dùng: node data/scripts/cli.js build … --apply) */
  // ── jsonl-batch: ${stamp} ──\n${rows.map(toRow).join('\n')}\n`;
  fs.writeFileSync(path.join(OUT_DIR, 'jsonl-rows.js'), jsOut, 'utf-8');

  console.log(`\n📦 Xong: ${rows.length} từ OK, ${skipped.length} từ lỗi.`);
  console.log(`   Xem trước: data/scripts/out/jsonl-rows.js  (+ dữ liệu thô jsonl-rows.json)`);

  if (opt.apply && rows.length) {
    const src = fs.readFileSync(SEED_FILE, 'utf-8');
    const end = findSeedEnd(src);
    if (end < 0) { console.error('✗ Không tìm thấy cuối mảng SEED_WORDS — chèn tay qua jsonl-rows.js.'); process.exit(1); }
    const out = src.slice(0, end) + `\n  // ── jsonl-batch: ${stamp} (data/scripts/build-from-jsonl.js) ──\n${rows.map(toRow).join('\n')}\n` + src.slice(end);
    fs.writeFileSync(SEED_FILE, out, 'utf-8');
    const { execSync } = require('child_process');
    try { execSync('node --check ' + JSON.stringify(SEED_FILE)); console.log(`✅ Đã chèn ${rows.length} từ vào js/seed-data.js (node --check OK).`); }
    catch (e) { console.error('✗ node --check THẤT BẠI — kiểm tra lại!'); console.error(e.message); process.exit(1); }
  } else {
    console.log('ℹ️ Chưa sửa file app. Muốn tự chèn chạy thêm: … --apply');
  }
})();
