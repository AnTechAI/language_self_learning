/**
 * format.ts — Tiện ích thuần (port từ legacy utils.js + course.js).
 * Không phụ thuộc DOM → test được trong vitest.
 */
import type { Course, Sense, WordEntry } from '@english/shared';

/** Chuẩn hóa chuỗi để so khớp đáp án (bỏ dấu VN, hoa-thường, dấu câu) */
export function normalize(str: string): string {
  return String(str || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:'"()\-–—]/g, '')
    .replace(/\s+/g, ' ');
}

/** Trộn ngẫu nhiên (Fisher-Yates) — mảng mới */
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Id duy nhất */
export function uid(): string {
  return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** Chuỗi ngày hôm nay YYYY-MM-DD (giờ địa phương) */
export function todayStr(d = new Date()): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/** Định dạng Date → YYYY-MM-DD */
export function fmtDate(d: Date): string {
  return todayStr(d);
}

/** Ký tự "tiết lộ được" khi gợi ý (không phải dấu câu / khoảng trắng) */
export function isRevealable(ch: string): boolean {
  return !/[\s.,!?;:'"()\-–—，。！？、；：·…]/.test(ch);
}

export function countRevealable(str: string): number {
  return [...String(str || '')].filter(isRevealable).length;
}

/** Che chuỗi, lộ n ký tự đầu (hỗ trợ Latin + chữ Trung) */
export function maskText(str: string, n: number): string {
  let seen = 0;
  return [...String(str || '')]
    .map((ch) => {
      if (isRevealable(ch)) {
        seen++;
        return seen <= n ? ch : '_';
      }
      return ch;
    })
    .join('');
}

/** Tách chuỗi phân cách bằng dấu phẩy */
export function splitList(str: string): string[] {
  return String(str || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ===== Bảng chữ cái có dấu pinyin (khóa tiếng Trung) ===== */
const TONE: Record<string, string> = {
  ā: 'a',
  á: 'a',
  ǎ: 'a',
  à: 'a',
  ē: 'e',
  é: 'e',
  ě: 'e',
  è: 'e',
  ī: 'i',
  í: 'i',
  ǐ: 'i',
  ì: 'i',
  ō: 'o',
  ó: 'o',
  ǒ: 'o',
  ò: 'o',
  ū: 'u',
  ú: 'u',
  ǔ: 'u',
  ù: 'u',
  ǖ: 'u',
  ǘ: 'u',
  ǚ: 'u',
  ǜ: 'u',
  ü: 'u',
};

/** Pinyin bỏ dấu thanh + chỉ giữ chữ cái ("nǐ hǎo" → "nihao") */
export function normPinyin(str: string): string {
  return String(str || '')
    .toLowerCase()
    .replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, (ch) => TONE[ch] || ch)
    .replace(/[^a-z]/g, '');
}

/* ===== Ngữ nghĩa theo khóa học ===== */

/** Nghĩa {source, target} của 1 sense theo khóa đang mở */
export function meaningOf(
  course: Course,
  sense: Sense | undefined,
): { source: string; target: string } {
  const m = (sense && sense.meaning) || {};
  if (!course) return { source: '', target: '' };
  return { source: m[course.source.code] || '', target: m[course.target.code] || '' };
}

/** Entry có bản dịch đích chưa */
export function hasTarget(course: Course, entry: WordEntry): boolean {
  if (!course) return false;
  return (entry.senses || []).some((s) => (s.meaning || {})[course.target.code]);
}

/** Chip loại từ của entry (Set để bỏ trùng) */
export function posList(entry: WordEntry): string[] {
  return Array.from(new Set((entry.senses || []).map((s) => s.partOfSpeech).filter(Boolean)));
}

/** Chọn 1 nghĩa để ôn — đa nghĩa thì ngẫu nhiên giữa các nghĩa */
/** Chuỗi hiển thị gốc từ (wordRoot có thể là string hoặc object ExtraSense-like) */
export function rootText(root: WordEntry['wordRoot'] | undefined): string {
  if (!root) return '';
  if (typeof root === 'string') return root;
  const parts: string[] = [];
  if (root.p) parts.push(root.p);
  const body = root.v || root.e || '';
  if (body) parts.push(body);
  return parts.join(' — ');
}

export function pickSense(entry: WordEntry): Sense | undefined {
  const arr = (entry && entry.senses) || [];
  if (!arr.length) return undefined;
  if (arr.length === 1) return arr[0];
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Nhãn hướng dịch */
export function directionLabel(course: Course, toSource: boolean): string {
  return toSource
    ? course.target.label + ' → ' + course.source.label
    : course.source.label + ' → ' + course.target.label;
}
