#!/usr/bin/env node
/**
 * cli.js — CLI CHUNG cho các script dữ liệu (GĐ 4, data/scripts).
 *
 * Mọi lệnh dữ liệu gọi qua 1 cửa: `node data/scripts/cli.js <lệnh> [tham số…]`
 * (tham số truyền nguyên vẹn xuống script tương ứng — xem header từng script).
 *
 *   node data/scripts/cli.js lessons --limit 300 --keep-existing
 *   node data/scripts/cli.js chunks
 *   node data/scripts/cli.js seed
 *   node data/scripts/cli.js icons
 *   node data/scripts/cli.js enrich --limit 10000
 *   node data/scripts/cli.js fetch --words "gratitude brave"
 *   node data/scripts/cli.js build --file list.txt --apply
 *
 * Cách dùng nhanh qua npm (root): npm run data:lessons -- --limit 1000
 */
const { spawnSync } = require('child_process');
const path = require('path');

const CMDS = {
  lessons: 'build-lessons.js',       // chia bài học (jsonl / enriched theo tần suất / HSK theo cấp)
  chunks: 'build-chunks.js',         // từ điển offline → js/bank/
  seed: 'export-seed.js',            // seed → seed.generated.ts
  icons: 'make-icons.js',            // icon PWA
  enrich: 'enrich-vi-ipa.py',        // làm giàu jsonl (vi + ipa + freq) — Python
  fetch: 'fetch-vocab.js',           // thêm từ mới từ API (en)
  hsk: 'fetch-hsk.js',               // tải từ điển TIẾNG TRUNG HSK 1–6 → hsk-dictionary.jsonl
  build: 'build-from-jsonl.js',      // dựng từ từ jsonl + API
};

const [cmd, ...args] = process.argv.slice(2);
if (!cmd || !CMDS[cmd]) {
  console.error('✗ Dùng: node data/scripts/cli.js <lệnh> [tham số…]');
  console.error('  Lệnh: ' + Object.keys(CMDS).join(' | '));
  process.exit(1);
}
const file = path.join(__dirname, CMDS[cmd]);
const runner = file.endsWith('.py') ? 'python' : process.execPath;
const r = spawnSync(runner, [file, ...args], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
