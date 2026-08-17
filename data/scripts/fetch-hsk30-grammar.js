/**
 * fetch-hsk30-grammar.js — Tải + phân tích NGỮ PHÁP HSK 3.0 theo cấp độ.
 *
 * Nguồn: krmanik/HSK-3.0 (GitHub) — "New HSK (2021)/HSK Grammar/HSK {1..6}.txt":
 * văn bản theo syllabus chính thức: mục (A.1.x), điểm ngữ pháp 【一01】… kèm VÍ DỤ CÂU.
 *
 * Đầu ra: apps/web/public/legacy/js/zh-dict/zh-grammar.json
 *   [{id, level, section, title, note, examples: []}]
 *
 * Cách chạy:
 *   node data/scripts/fetch-hsk30-grammar.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'apps', 'web', 'public', 'legacy', 'js', 'zh-dict', 'zh-grammar.json');
const BASE = 'https://raw.githubusercontent.com/krmanik/HSK-3.0/master/New%20HSK%20(2021)/HSK%20Grammar/HSK%20{level}.txt';
const LEVELS = [1, 2, 3, 4, 5, 6];

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
  return res.text();
}

/** Có phải dòng tiêu đề mục (A.1.1 词类 / A.1.1.1 名词)? */
function isHeader(line) {
  return /^[A-ZА-Я]\.\d/.test(line) || /^[一二三四五六七八九十]级([语法|词汇])/.test(line);
}

function parseLevel(text, level) {
  const points = [];
  let cur = null;
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^【([^】]+)】\s*(.*)$/);
    if (m) {
      if (cur) points.push(cur);
      const title = m[2] || m[1];
      const colon = title.indexOf('：');
      cur = {
        id: 'hsk3g_' + level + '_' + String(points.length + 1).padStart(3, '0'),
        level,
        code: m[1].trim(),
        title: colon > 0 ? title.slice(colon + 1).trim() || title : title,
        note: title,
        examples: [],
      };
      continue;
    }
    if (!cur) continue;
    if (!isHeader(line)) cur.examples.push(line);
  }
  if (cur) points.push(cur);
  return points;
}

async function main() {
  const all = [];
  for (const L of LEVELS) {
    const url = BASE.replace('{level}', L);
    const text = await fetchText(url);
    const pts = parseLevel(text, L);
    all.push(...pts);
    console.log(`   HSK ${L}: ${pts.length} điểm ngữ pháp`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(all), 'utf-8');
  console.log('\n✅ ' + OUT + ' — ' + all.length + ' điểm');
  const ex = all.filter((p) => p.examples.length).length;
  console.log(`   ${ex} điểm có ví dụ. Mẫu:`, (all[0] || {}).title, '→', ((all[0] || {}).examples || []).slice(0, 2));
}

main().catch((err) => { console.error('✗', err.message); process.exit(1); });