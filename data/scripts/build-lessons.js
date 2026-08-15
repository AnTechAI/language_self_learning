/**
 * build-lessons.js — TẠO BÀI HỌC (LESSON) từ english-dictionary.jsonl.
 *
 * Luồng:
 *   1) Đọc danh sách từ cần dựng (--file data/scripts/lesson-words.txt / --words / --limit).
 *   2) Với mỗi từ: gom MỌI dòng trong JSONL → nhiều nghĩa/loại từ,
 *      dịch nghĩa tiếng Việt (Google Translate), lấy phiên âm IPA (Free Dictionary API).
 *   3) CHIA THÀNH CÁC BÀI HỌC, mỗi bài đúng LESSON_SIZE từ (mặc định 20).
 *   4) Xuất ra js/lessons/:
 *        - manifest.js      : danh sách bài (id, tiêu đề, chủ đề, số từ)
 *        - lesson-001.js…   : dữ liệu từng bài (định dạng nén như SEED_WORDS)
 *      App chỉ TẢI ĐÚNG bài học người dùng chọn (truy xuất theo nhu cầu, offline).
 *
 * Cách dùng:
 *   node data/scripts/cli.js lessons --file data/scripts/lesson-words.txt
 *   node data/scripts/cli.js lessons --words "laundry kettle broom"
 *   node data/scripts/cli.js lessons --limit 60 --tag "đời sống"
 *   node data/scripts/cli.js lessons --size 10        # mỗi bài 10 từ thay vì 20
 *   node data/scripts/cli.js lessons --no-cache       # không dùng lại cache API cũ
 *
 * CHẾ ĐỘ ENRICHED (GĐ 4 — chia bài từ TOÀN BỘ từ đã làm giàu, KHÔNG gọi API):
 *   Nếu có data/raw/english-dictionary.enriched.jsonl (data/scripts/enrich-vi-ipa.py)
 *   thì MẶC ĐỊNH dùng nguồn đó: đọc thẳng vi/ipa/freq → xếp theo TẦN SUẤT
 *   (từ thông dụng trước) → chia bài 20 từ. Không dịch, không lấy IPA nữa.
 *
 *   node data/scripts/cli.js lessons                              # enriched, tần suất
 *   node data/scripts/cli.js lessons --source raw                 # ép dùng jsonl gốc
 *   node data/scripts/cli.js lessons --src <file>                 # file enriched khác
 *   node data/scripts/cli.js lessons --limit 1000                 # chỉ 1000 từ thông dụng nhất
 *   node data/scripts/cli.js lessons --from 1000 --limit 1000     # lô tiếp theo (bài 51+)
 *   node data/scripts/cli.js lessons --order alpha                # xếp theo a→z thay vì tần suất
 *   node data/scripts/cli.js lessons --include-seed               # giữ cả từ đã có trong seed
 *   node data/scripts/cli.js lessons --keep-existing              # THÊM bài mới, không xóa bài cũ
 *   node data/scripts/cli.js lessons --out-dir /tmp/lessons       # ghi ra thư mục khác (test)
 *
 * Cache kết quả API ở data/scripts/out/lesson-cache.json để chạy lại không tốn request.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED_FILE = path.join(ROOT, 'apps', 'web', 'public', 'legacy', 'js', 'seed-data.js');
const JSONL_FILE = path.join(ROOT, 'data', 'raw', 'english-dictionary.jsonl');
const ENRICHED_FILE = path.join(ROOT, 'data', 'raw', 'english-dictionary.enriched.jsonl');
const OUT_DIR = path.join(ROOT, 'apps', 'web', 'public', 'legacy', 'js', 'lessons');
const TOOL_OUT = path.join(__dirname, 'out');
const CACHE_FILE = path.join(TOOL_OUT, 'lesson-cache.json');

const API_DICT = (w) => `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`;
const API_TRANS = (q) => `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(q)}`;
const DELAY_MS = 500;
const MAX_RETRY = 3;
const LESSON_SIZE = 20;

/* ================= tiện ích (giống build-from-jsonl.js) ================= */
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
  s = s[0].toUpperCase() + s.slice(1);
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

/* ================= dựng 1 từ (giống build-from-jsonl) ================= */
async function buildWord(word, entries, allowNoIpa) {
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
  const extras = rawSenses.filter((s) => s !== primary).slice(0, 4);

  let ipa = '';
  if (/^[a-z]+(?:['-][a-z]+)*$/i.test(word)) {
    const d = await getJSON(API_DICT(word));
    if (d && d.length) ipa = (d[0].phonetics || []).map((p) => p.text || '').find((t) => t) || '';
  }
  if (!ipa && !allowNoIpa) return { word, ok: false, reason: 'không có phiên âm (API)' };

  const viCache = new Map();
  const wordVI = cleanVI(await translate(word));
  viCache.set('__word__', wordVI);
  async function viFor(sense) {
    if (viCache.has(sense.e)) return viCache.get(sense.e);
    let v = cleanVI(await translate(sense.e)).slice(0, 130);
    if (!v || v.length > 140 || v.toLowerCase().replace(/[^a-z]/g, '') === word.toLowerCase()) v = wordVI || '';
    viCache.set(sense.e, v);
    return v;
  }

  let primaryVI = wordVI;
  if (!primaryVI || primaryVI.length > 50 || primaryVI.toLowerCase().replace(/[^a-z]/g, '') === word.toLowerCase()) {
    primaryVI = await viFor(primary);
  }
  if (!primaryVI) return { word, ok: false, reason: 'không dịch được nghĩa' };

  const extraObjs = [];
  for (const x of extras) {
    const v = await viFor(x);
    if (!v) continue;
    extraObjs.push({ p: x.p, i: ipa, e: x.e, v, x: x.x, s: x.s, a: x.a });
  }
  return { word, ok: true, row: [word, ipa, primary.p, primary.e, primaryVI, primary.x || '', '', primary.s, primary.a, '', ...extraObjs] };
}

/* ================= in dòng nén (định dạng SEED_WORDS) ================= */
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
  return new Set([...src.slice(start, end).matchAll(/^\s*\[\s*['"]([^'"]+)['"]/gm)].map((m) => m[1].toLowerCase()));
}

/* ================= chính ================= */
function parseArgs() {
  const a = process.argv.slice(2);
  const opt = { words: [], file: '', limit: 0, from: 0, tag: '', size: LESSON_SIZE, noCache: false, source: '', src: '', order: 'freq', includeSeed: false, keepExisting: false, outDir: '' };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--no-cache') opt.noCache = true;
    else if (a[i] === '--size') { opt.size = parseInt(a[i + 1], 10) || LESSON_SIZE; i++; }
    else if (a[i] === '--tag') { opt.tag = a[i + 1] || ''; i++; }
    else if (a[i] === '--limit') { opt.limit = parseInt(a[i + 1], 10) || 0; i++; }
    else if (a[i] === '--from') { opt.from = parseInt(a[i + 1], 10) || 0; i++; }
    else if (a[i] === '--words') { opt.words = (a[i + 1] || '').split(/\s+/).filter(Boolean); i++; }
    else if (a[i] === '--file') { opt.file = a[i + 1] || ''; i++; }
    else if (a[i] === '--source') { opt.source = (a[i + 1] || '').toLowerCase(); i++; }
    else if (a[i] === '--src') { opt.src = a[i + 1] || ''; i++; }
    else if (a[i] === '--order') { opt.order = (a[i + 1] || 'freq').toLowerCase(); i++; }
    else if (a[i] === '--include-seed') opt.includeSeed = true;
    else if (a[i] === '--keep-existing') opt.keepExisting = true;
    else if (a[i] === '--out-dir') { opt.outDir = a[i + 1] || ''; i++; }
  }
  return opt;
}

/* ===== CHẾ ĐỘ ENRICHED: đọc file làm giàu (vi+ipa+freq), KHÔNG gọi API ===== */
async function buildLessonsFromEnriched(opt) {
  const srcFile = opt.src || (fs.existsSync(ENRICHED_FILE) ? ENRICHED_FILE : '');
  if (!srcFile || !fs.existsSync(srcFile)) {
    console.error('✗ Chế độ enriched cần ' + ENRICHED_FILE + ' — hãy chạy: python data/scripts/enrich-vi-ipa.py');
    process.exit(1);
  }
  const outDir = opt.outDir ? path.resolve(ROOT, opt.outDir) : OUT_DIR;

  // --- Gom mọi dòng theo từ; mỗi dòng là 1 nghĩa (đã có vi sẵn) ---
  console.log('📖 Đang đọc ' + path.basename(srcFile) + '…');
  const byWord = new Map();
  const rl = readline.createInterface({ input: fs.createReadStream(srcFile), crlfDelay: Infinity });
  let lines = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch (err) { continue; }
    const w = String(e.word || '').toLowerCase();
    if (!w) continue;
    lines++;
    const def = cleanEN(e.definition, 170);
    if (!def) continue;
    if (!byWord.has(w)) byWord.set(w, []);
    byWord.get(w).push({
      p: normPOS(e.partOfSpeech),
      e: def,
      v: cleanVI(e.vi),
      x: cleanEN(Array.isArray(e.examples) ? (e.examples[0] || '') : (e.examples || ''), 120),
      s: cleanList(e.synonyms, w),
      a: cleanList(e.antonyms, w),
      i: String(e.ipa || ''),
      freq: typeof e.freq === 'number' ? e.freq : 0,
    });
  }
  rl.close();
  console.log(`   ${lines} dòng → ${byWord.size} từ.`);

  // --- Chỉ giữ từ HỌC ĐƯỢC (có nghĩa Việt); loại trùng nghĩa ---
  const existing = opt.includeSeed ? new Set() : existingSeedWords();
  const wordList = [];
  for (const [w, senses] of byWord) {
    const seen = new Set();
    const uniq = senses.filter((s) => { if (!s.v || seen.has(s.e.toLowerCase())) return false; seen.add(s.e.toLowerCase()); return true; });
    if (!uniq.length) continue;                    // không dịch được → không học được
    if (existing.has(w)) continue;                 // đã có trong kho cơ bản
    wordList.push({ w, freq: Math.max(...uniq.map((s) => s.freq)), senses: uniq });
  }
  console.log(`   Học được: ${wordList.length} từ (${byWord.size - wordList.length} bỏ: thiếu nghĩa Việt / trùng seed).`);

  // --- Xếp thứ tự: tần suất giảm dần (mặc định) hoặc a→z ---
  if (opt.order === 'freq') {
    wordList.sort((a, b) => (b.freq - a.freq) || a.w.localeCompare(b.w));
  } else {
    wordList.sort((a, b) => a.w.localeCompare(b.w));
  }
  const total = wordList.length;
  const from = Math.min(opt.from, total);
  const sliced = wordList.slice(from, opt.limit > 0 ? from + opt.limit : total);
  console.log(`   Xếp theo ${opt.order === 'freq' ? 'TẦN SUẤT (thông dụng trước)' : 'bảng chữ cái'}: ${from + 1}–${from + sliced.length}/${total}.`);

  // --- Dựng từng dòng nén (định dạng SEED_WORDS, giống chế độ cũ) ---
  const rowsByWord = new Map();
  for (const it of sliced) {
    const { w, senses } = it;
    const byPos = {};
    senses.forEach((s) => { byPos[s.p] = (byPos[s.p] || 0) + 1; });
    let primaryPos = 'other', best = -1;
    for (const p of Object.keys(byPos)) {
      if (byPos[p] > best || (byPos[p] === best && POS_PRIORITY.indexOf(p) < POS_PRIORITY.indexOf(primaryPos))) {
        primaryPos = p; best = byPos[p];
      }
    }
    const samePos = senses.filter((s) => s.p === primaryPos).sort((a, b) => a.e.length - b.e.length);
    const primary = samePos[0];
    const extras = senses.filter((s) => s !== primary).slice(0, 4).map((x) => ({
      p: x.p, i: x.i || primary.i || '', e: x.e, v: x.v, x: x.x, s: x.s, a: x.a,
    }));
    rowsByWord.set(w, [w, primary.i || '', primary.p, primary.e, primary.v, primary.x || '', '', primary.s, primary.a, '', ...extras]);
  }

  // --- Gom thành BÀI HỌC (mỗi bài opt.size từ, theo thứ tự đã xếp) ---
  const built = sliced.map((it) => it.w);
  const tag = opt.tag || 'Từ phổ biến';
  const lessons = [];
  for (let i = 0; i < built.length; i += opt.size) {
    const group = built.slice(i, i + opt.size);
    lessons.push({
      id: 'lesson-' + String(lessons.length + 1).padStart(3, '0'),
      title: 'Bài ' + (lessons.length + 1) + ' · ' + tag,
      tag,
      words: group.map((w) => rowsByWord.get(w)),
    });
  }

  // --- Ghi js/lessons/ (xóa bài cũ trừ khi --keep-existing) ---
  fs.mkdirSync(outDir, { recursive: true });
  let existingLessons = [];
  if (opt.keepExisting && fs.existsSync(path.join(outDir, 'manifest.js'))) {
    try {
      const src = fs.readFileSync(path.join(outDir, 'manifest.js'), 'utf-8');
      // chấp nhận cả key có nháy (JSON.stringify) lẫn key trần: {"id":…} / {id:…}
      const m = src.match(/\[\s*\{.*\}\]\s*\)/s);
      if (m) {
        let txt = m[0].replace(/\)$/, '').trim();
        try { existingLessons = JSON.parse(txt); }
        catch (e) { existingLessons = JSON.parse(txt.replace(/([{,])\s*([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')); }
      }
    } catch (err) { existingLessons = []; }
    console.log(`   Giữ ${existingLessons.length} bài cũ, thêm ${lessons.length} bài mới.`);
  } else {
    for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));
  }
  const startNum = existingLessons.reduce((mx, l) => {
    const n = parseInt(String(l.id || '').replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(mx, n) : mx;
  }, 0);
  lessons.forEach((l, i) => {
    l.id = 'lesson-' + String(startNum + i + 1).padStart(3, '0');
    l.title = 'Bài ' + (startNum + i + 1) + ' · ' + tag;
    const body = '(function(){window.VocabApp.lessonsRegister(' + JSON.stringify(l.id + '.js') +
      ',{tag:' + JSON.stringify(l.tag) + ',words:[\n' +
      l.words.map((row) => toRow({ row })).join('\n') + '\n]});})();\n';
    fs.writeFileSync(path.join(outDir, l.id + '.js'), body, 'utf-8');
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const allMeta = [...existingLessons, ...lessons.map((l) => ({ id: l.id, title: l.title, file: l.id + '.js', tag: l.tag, count: l.words.length }))];
  fs.writeFileSync(path.join(outDir, 'manifest.js'),
    '/* Bài học — sinh bởi data/scripts/build-lessons.js (' + stamp + ') · nguồn: ' + path.basename(srcFile) + ' */\n' +
    'window.VocabApp.lessonsInit(' + JSON.stringify(allMeta) + ');\n', 'utf-8');

  console.log(`\n📚 Xong: ${lessons.length} bài học (mỗi bài ${opt.size} từ) tại ${outDir}.`);
  lessons.slice(0, 8).forEach((l) => console.log(`   ${l.id} — ${l.title} (${l.words.length} từ)`));
  if (lessons.length > 8) console.log(`   … tổng ${lessons.length} bài (${built.length} từ).`);
}

(async () => {
  const opt = parseArgs();
  // Chế độ nguồn: --source rõ ràng, --src chỉ định file enriched,
  // mặc định ưu tiên file enriched (nếu có)
  const useEnriched = opt.source === 'enriched' || !!opt.src || (!opt.source && fs.existsSync(ENRICHED_FILE));
  if (useEnriched) {
    await buildLessonsFromEnriched(opt);
    return;
  }
  if (!fs.existsSync(JSONL_FILE)) { console.error('✗ Không tìm thấy ' + JSONL_FILE); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TOOL_OUT, { recursive: true });

  // --- Danh sách từ (word + tag) ---
  let want = [];
  if (opt.words.length) want = opt.words.map((w) => ({ word: w.toLowerCase(), tag: opt.tag || 'đời sống' }));
  else if (opt.file) {
    let curTag = opt.tag || 'đời sống';
    fs.readFileSync(opt.file, 'utf-8').split(/\r?\n/).forEach((line) => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      if (t.startsWith('@')) { curTag = t.slice(1).trim() || curTag; return; }
      want.push({ word: t.toLowerCase(), tag: curTag });
    });
  } else if (opt.limit > 0) {
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
  if (!want.length) { console.error('✗ Cho biết: --file list.txt / --words "…" / --limit N'); process.exit(1); }
  // Bỏ trùng từ (giữ lần xuất hiện đầu)
  want = want.filter((it, i) => want.findIndex((x) => x.word === it.word) === i);

  // --- Bỏ từ đã có trong kho cơ bản ---
  const existing = existingSeedWords();
  const todo = want.filter((it) => !existing.has(it.word));
  const dupes = want.length - todo.length;
  if (dupes) console.log(`⏭️ Bỏ ${dupes} từ đã có trong kho cơ bản.`);
  if (!todo.length) { console.log('ℹ️ Không còn từ mới để dựng bài học.'); process.exit(0); }

  // --- Cache kết quả API ---
  let cache = {};
  if (!opt.noCache && fs.existsSync(CACHE_FILE)) {
    try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')); } catch (e) { cache = {}; }
    const cached = todo.filter((it) => cache[it.word]);
    if (cached.length) console.log(`♻️ Dùng lại cache của ${cached.length} từ: ${cached.slice(0, 6).map((x) => x.word).join(', ')}…`);
  }

  console.log(`📖 Đang đọc english-dictionary.jsonl (lọc ${todo.length} từ)…`);
  const need = todo.filter((it) => !cache[it.word]);
  const map = await loadJsonlEntries(new Set(need.map((it) => it.word)));
  const missing = need.filter((it) => !map.has(it.word)).map((it) => it.word);
  if (missing.length) console.log(`⚠️ ${missing.length} từ không có trong JSONL: ${missing.slice(0, 8).join(', ')}…`);

  // --- Dựng từng từ (ưu tiên cache) ---
  console.log(`🔨 Đang dựng ${need.length - missing.length} từ (dịch Việt + phiên âm API)…\n`);
  const rowsByWord = new Map(Object.entries(cache));
  const skipped = [];
  for (let i = 0; i < todo.length; i++) {
    const it = todo[i];
    const w = it.word;
    if (rowsByWord.has(w)) continue;
    if (!map.has(w)) { skipped.push({ word: w, reason: 'không có trong JSONL' }); continue; }
    const r = await buildWord(w, map.get(w), true);
    if (r.ok) {
      rowsByWord.set(w, r.row);
      const nSense = r.row.length > 10 ? r.row.length - 9 : 1;
      console.log(`  ✓ [${i + 1}/${todo.length}] ${w}  (${r.row[2]}${nSense > 1 ? ' +' + (nSense - 1) + ' nghĩa' : ''})  → ${r.row[4]}`);
    } else {
      skipped.push({ word: w, reason: r.reason });
      console.log(`  ✗ [${i + 1}/${todo.length}] ${w}  — ${r.reason}`);
    }
    await sleep(DELAY_MS);
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(rowsByWord), null, 0), 'utf-8');
      console.log(`   (đã lưu tiến độ ${rowsByWord.size} từ vào cache)`);
    }
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(rowsByWord), null, 0), 'utf-8');

  // --- Gom thành BÀI HỌC (mỗi bài LESSON_SIZE từ, theo thứ tự danh sách) ---
  const built = todo.filter((it) => rowsByWord.has(it.word));
  const lessons = [];
  for (let i = 0; i < built.length; i += opt.size) {
    const group = built.slice(i, i + opt.size);
    const tagCounts = {};
    group.forEach((g) => { tagCounts[g.tag] = (tagCounts[g.tag] || 0) + 1; });
    const tag = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a])[0] || 'đời sống';
    lessons.push({
      id: 'lesson-' + String(lessons.length + 1).padStart(3, '0'),
      title: 'Bài ' + (lessons.length + 1) + ' · ' + tag,
      tag,
      words: group.map((g) => rowsByWord.get(g.word)),
    });
  }

  // --- Ghi js/lessons/ ---
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));
  const stamp = new Date().toISOString().slice(0, 10);
  lessons.forEach((l) => {
    const body = '(function(){window.VocabApp.lessonsRegister(' + JSON.stringify(l.id + '.js') +
      ',{tag:' + JSON.stringify(l.tag) + ',words:[\n' +
      l.words.map((row) => toRow({ row })).join('\n') + '\n]});})();\n';
    fs.writeFileSync(path.join(OUT_DIR, l.id + '.js'), body, 'utf-8');
  });
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.js'),
    '/* Bài học — sinh bởi data/scripts/build-lessons.js (' + stamp + ') */\n' +
    'window.VocabApp.lessonsInit(' + JSON.stringify(lessons.map((l) => ({ id: l.id, title: l.title, file: l.id + '.js', tag: l.tag, count: l.words.length }))) + ');\n', 'utf-8');

  console.log(`\n📚 Xong: ${lessons.length} bài học, mỗi bài ${opt.size} từ (${built.length} từ OK, ${skipped.length} lỗi).`);
  lessons.forEach((l) => console.log(`   ${l.id} — ${l.title} (${l.words.length} từ)`));
  console.log(`   Dữ liệu tại js/lessons/ — app tải đúng bài khi bạn chọn.`);
  if (skipped.length) console.log(`   Bỏ qua: ${skipped.map((s) => s.word).join(', ')}`);
})();
