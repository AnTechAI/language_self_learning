/**
 * fetch-zh-examples.js — Lấy VÍ DỤ CÂU cho từ điển tiếng Trung HSK 3.0.
 *
 * Nguồn: dict.youdao.com/jsonapi (câu song ngữ blng_sents_part — zh + en)
 *        + Google Translate (dịch sang tiếng Việt)
 *        + pinyin-pro (phiên âm cả câu, offline)
 *
 * Đọc:  apps/web/public/legacy/js/zh-dict/hsk.json (5.363 từ đã dựng)
 * Ghi:  data/raw/zh-examples.jsonl  — { word, examples: [{zh, pinyin, vi, en}] }
 *
 * TÍNH NĂNG:
 *   - resumable: bỏ qua từ đã có trong file output → chạy lại không mất công
 *   - retry/backoff cho 429/5xx/timeout (3 lần)
 *   - workers + delay điều chỉnh được
 *
 * Cách chạy:
 *   node data/scripts/fetch-zh-examples.js            # toàn bộ
 *   node data/scripts/fetch-zh-examples.js --max 300  # thử 300 từ (prototype)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const HSK = path.join(ROOT, 'apps', 'web', 'public', 'legacy', 'js', 'zh-dict', 'hsk.json');
const OUT = path.join(ROOT, 'data', 'raw', 'zh-examples.jsonl');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const MAX = parseArg('--max', Infinity);
const WORKERS = Number(parseArg('--workers', 8));
const DELAY = Number(parseArg('--delay', 0.12));

function parseArg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : String(def);
}

/** Fetch có retry/backoff (429/5xx/timeout) */
async function fetchJSON(url, opts = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20000);
      const res = await fetch(url, {
        ...opts,
        signal: ctl.signal,
        headers: { 'User-Agent': UA, Referer: 'https://dict.youdao.com/', ...(opts.headers || {}) },
      });
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) {
        throw new Error('HTTP ' + res.status);
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep([800, 2000, 4500][i] || 2000);
    }
  }
  throw new Error('unreachable');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lấy ví dụ câu từ Youdao (blng → media fallback) */
async function youdaoExamples(word) {
  const d = await fetchJSON('https://dict.youdao.com/jsonapi?q=' + encodeURIComponent(word));
  const clean = (s) => String(s || '').replace(/<[^>]+>/g, '').trim();
  const blng = (d.blng_sents_part && d.blng_sents_part['sentence-pair']) || [];
  const media = (d.media_sents_part && d.media_sents_part['sentence-pair']) || [];
  const pairs = blng.length ? blng : media;
  return pairs
    .map((s) => ({ zh: clean(s.sentence), en: clean(s['sentence-translation']) }))
    .filter((s) => s.zh && s.zh.length <= 60)
    .slice(0, 2);
}

/** Google Translate zh → vi (retry/backoff 429) */
async function translateVi(zh) {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=' +
    encodeURIComponent(zh);
  for (let i = 0; i < 4; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA } });
      clearTimeout(t);
      if (res.status === 429) {
        await sleep(1200 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const vi = (data[0] || []).map((p) => p[0] || '').join('');
      return vi.trim();
    } catch {
      await sleep(800 * (i + 1));
    }
  }
  return '';
}

async function main() {
  const words = JSON.parse(fs.readFileSync(HSK, 'utf-8'));
  console.log(`📚 ${words.length} từ trong hsk.json`);

  // Đọc tiến độ cũ (resume)
  const done = new Map();
  if (fs.existsSync(OUT)) {
    for (const line of fs.readFileSync(OUT, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line);
        if (o && o.word) done.set(o.word, o.examples || []);
      } catch {
        /* bỏ qua dòng lỗi */
      }
    }
  }
  console.log(`↻ Đã có ${done.size} từ — tiếp tục từ đó.`);

  const todo = words.filter((w) => !done.has(w.simplified));
  const queue = todo.slice(0, MAX === Infinity ? todo.length : Math.min(MAX, todo.length));
  console.log(`⚙️  Fetch ${queue.length} từ (workers=${WORKERS}, delay=${DELAY}s)`);

  const out = fs.createWriteStream(OUT, { flags: 'a' });
  let cursor = 0;
  let ok = 0;
  let empty = 0;
  const t0 = Date.now();

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= queue.length) return;
      const w = queue[i].simplified;
      try {
        const exs = await youdaoExamples(w);
        if (exs.length) {
          const pinyin = require('pinyin-pro').pinyin(exs.map((e) => e.zh).join('\n'), {
            toneType: 'symbol',
          }).split('\n');
          const enriched = [];
          for (let k = 0; k < exs.length; k++) {
            const vi = await translateVi(exs[k].zh);
            enriched.push({ zh: exs[k].zh, pinyin: pinyin[k] || '', vi, en: exs[k].en });
          }
          out.write(JSON.stringify({ word: w, examples: enriched }) + '\n');
          ok++;
        } else {
          out.write(JSON.stringify({ word: w, examples: [] }) + '\n');
          empty++;
        }
      } catch (e) {
        console.log(`✗ ${w}: ${e.message}`);
        out.write(JSON.stringify({ word: w, examples: [] }) + '\n');
        empty++;
      }
      if ((ok + empty) % 50 === 0) {
        const el = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(`  … ${ok + empty}/${queue.length} (ok=${ok}, empty=${empty}, ${el}s)`);
      }
      await sleep(DELAY * 1000);
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, () => worker()));
  out.end();
  const el = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n✅ Xong ${queue.length} từ trong ${el}s — có ví dụ: ${ok}, không có: ${empty}`);
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
