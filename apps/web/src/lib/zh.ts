/**
 * lib/zh.ts — Tiện ích riêng cho khóa TIẾNG TRUNG (HSK 3.0).
 * Pinyin, thanh điệu, SM-2 (SRS), parse cấp độ từ tiêu đề bài.
 */

/** Bỏ dấu thanh pinyin → chữ thường không dấu (cho tìm kiếm). 'nǐ hǎo' → 'ni hao' */
export function stripTones(pinyin: string): string {
  return String(pinyin || '')
    .replace(/[āáǎà]/g, 'a')
    .replace(/[ēéěè]/g, 'e')
    .replace(/[īíǐì]/g, 'i')
    .replace(/[ōóǒò]/g, 'o')
    .replace(/[ūúǔù]/g, 'u')
    .replace(/[ǖǘǚǜü]/g, 'u')
    .replace(/[ńň]/g, 'n')
    .replace(/[ḿ]/g, 'm')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tách âm tiết từ pinyin_numeric 'ni3 hao3' → [{spell, tone}] (tone 0 = thanh nhẹ) */
export function syllablesFromNumeric(
  numeric: string,
): { spell: string; tone: 0 | 1 | 2 | 3 | 4 }[] {
  return String(numeric || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((syl) => {
      const m = syl.match(/^([a-zü]+?)(\d)?$/i);
      if (!m) return { spell: syl.toLowerCase(), tone: 0 as const };
      const t = m[2] ? parseInt(m[2], 10) : 0;
      return { spell: m[1].toLowerCase(), tone: (t >= 1 && t <= 4 ? t : 0) as 0 | 1 | 2 | 3 | 4 };
    });
}

const MARK_TONE: Record<string, number> = {
  ā: 1,
  á: 2,
  ǎ: 3,
  à: 4,
  ē: 1,
  é: 2,
  ě: 3,
  è: 4,
  ī: 1,
  í: 2,
  ǐ: 3,
  ì: 4,
  ō: 1,
  ó: 2,
  ǒ: 3,
  ò: 4,
  ū: 1,
  ú: 2,
  ǔ: 3,
  ù: 4,
  ǖ: 1,
  ǘ: 2,
  ǚ: 3,
  ǜ: 4,
  ń: 1,
  ň: 3,
  ḿ: 2,
};

/** 'nǐ hǎo' → 'ni3 hao3' (thanh nhẹ/không dấu → không thêm số) */
export function numericFromMarked(pinyin: string): string {
  return String(pinyin || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((syl) => {
      let tone = 0;
      const clean = syl.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňḿ]/g, (m) => {
        tone = MARK_TONE[m] || tone;
        return m
          .replace(/[āáǎà]/, 'a')
          .replace(/[ēéěè]/, 'e')
          .replace(/[īíǐì]/, 'i')
          .replace(/[ōóǒò]/, 'o')
          .replace(/[ūúǔù]/, 'u')
          .replace(/[ǖǘǚǜ]/, 'ü');
      });
      return tone ? clean + tone : clean;
    })
    .join(' ');
}

/** Ghép chữ với âm tiết (1:1); nếu lệch số lượng → chỉ gán đúng phần đầu */
export function charTones(
  word: string,
  numeric: string,
): { char: string; tone: 0 | 1 | 2 | 3 | 4 }[] {
  const syls = syllablesFromNumeric(numeric);
  return [...word].map((c, i) => ({ char: c, tone: syls[i] ? syls[i].tone : 0 }));
}

export interface ToneCurve {
  label: string; // '1 · thanh bằng' …
  name: string;
  color: string;
  /** 5 mức pitch trên thang 1–5 (thấp→cao→thấp?) theo giây 0→1 */
  path: string; // SVG path viewBox 0 0 120 120
}

/** Đường cong 4 thanh điệu + thanh nhẹ (viewBox 0 0 120 120) */
const P = (pts: [number, number][]) => 'M ' + pts.map(([x, y]) => `${x} ${y}`).join(' L ') + '';
const TH = 118,
  LO = 92,
  MID = 60,
  HI = 28;

export const TONE_CURVES: Record<string, ToneCurve> = {
  '1': {
    label: '1 · thanh bằng',
    name: '阴平',
    color: '#16a34a',
    path: P([
      [8, MID],
      [40, MID],
      [72, MID],
      [TH, MID],
    ]),
  },
  '2': {
    label: '2 · thanh lên',
    name: '阳平',
    color: '#2563eb',
    path: P([
      [8, LO],
      [40, LO],
      [72, MID],
      [TH, HI],
    ]),
  },
  '3': {
    label: '3 · thanh xuống-lên',
    name: '上声',
    color: '#d97706',
    path: P([
      [8, HI],
      [36, LO + 24],
      [70, LO],
      [98, HI],
      [TH, HI],
    ]),
  },
  '4': {
    label: '4 · thanh xuống',
    name: '去声',
    color: '#dc2626',
    path: P([
      [8, HI],
      [40, HI],
      [72, MID + 20],
      [TH, LO],
    ]),
  },
  '0': {
    label: '0 · thanh nhẹ',
    name: '轻声',
    color: '#6b7280',
    path: P([
      [8, MID],
      [40, MID],
      [72, MID],
      [TH, MID],
    ]),
  },
};
export const TONE_OPTIONS = ['1', '2', '3', '4', '0'];

/** SM-2 (Anki-style) — grade: 0=Again 1=Hard 2=Good 3=Easy */
export function sm2(
  grade: 0 | 1 | 2 | 3,
  prev?: { ease: number; interval: number; reps: number },
): { ease: number; interval: number; reps: number } {
  const ease = Math.max(
    1.3,
    (prev ? prev.ease : 2.5) + (grade === 3 ? 0.15 : grade === 0 ? -0.2 : 0),
  );
  let interval: number;
  if (grade === 0)
    interval = 0; // hôm nay ôn lại
  else if ((prev?.reps ?? 0) === 0) interval = grade === 3 ? 4 : 1;
  else if (prev!.reps === 1 && grade >= 2) interval = grade === 3 ? 7 : 6;
  else {
    const mult = grade === 1 ? 1.2 : grade === 2 ? ease : ease * 1.3;
    interval = Math.max(1, Math.round(prev!.interval * mult));
  }
  return { ease, interval, reps: (prev?.reps ?? 0) + 1 };
}

/** Ngày đến hạn: hôm nay + N ngày (chuỗi YYYY-MM-DD) */
export function dueIn(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Cấp độ HSK từ tiêu đề bài 'HSK 2 · Bài 3' → 2 */
export function levelFromLessonTitle(title: string): number | undefined {
  const m = String(title || '').match(/HSK\s*(\d)/i);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Lọc từ có trong tay (kho) cho hàng đợi luyện viết/quiz */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Nối số đếm tiếng Việt */
export function vnCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}
