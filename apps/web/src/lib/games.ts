/**
 * games.ts — Logic game THUẦN (port từ legacy ui-games.js).
 * Tách phần biến đổi dữ liệu khỏi phần render → test được, UI (React) chỉ render.
 */
import type { Course, WordEntry } from '@english/shared';
import { hasTarget, normalize, shuffle } from './format';

export type GameType = 'flashcard' | 'translate' | 'synonym' | 'antonym';

export interface GameSession {
  type: GameType;
  idx: number;
  correct: number;
  total: number;
  streakNow: number;
  repeated: Record<string, number>;
  missed: string[];
  queue: WordEntry[];
  key?: 'synonyms' | 'antonyms';
  // flashcard
  revealed?: boolean;
  seenOnce?: boolean;
  // translate
  dir?: 't2s' | 's2t';
  hints?: number;
  tempAnswer?: string;
  // choice game (synonym/antonym)
  current?: { entry: WordEntry; correctWord: string; options: string[] };
  // kết quả câu vừa trả lời (choice/translate) để render feedback
  answered?: boolean;
  lastAnswer?: { chosen: string; correctWord: string; isCorrect: boolean };
}

export interface AnswerOutcome {
  session: GameSession;
  isCorrect: boolean;
  finished: boolean; // đã hết câu hỏi chưa
}

/** Lọc pool từ vựng hợp lệ cho game (có nghĩa đích, theo phạm vi bài) */
export function buildPool(
  entries: WordEntry[],
  course: Course,
  opts: { lessonId?: string | null; onlyIds?: string[] } = {},
): WordEntry[] {
  return entries.filter(
    (e) =>
      e.senses &&
      hasTarget(course, e) &&
      (!opts.onlyIds || opts.onlyIds.includes(e.id)) &&
      (!opts.lessonId || e.lessonId === opts.lessonId),
  );
}

/** Tạo session ban đầu cho game loại thường (flashcard/translate) */
export function startSimpleSession(
  type: 'flashcard' | 'translate',
  pool: WordEntry[],
  qty: number,
): GameSession {
  let q = shuffle(pool);
  if (qty > 0 && q.length > qty) q = q.slice(0, qty);
  return {
    type,
    idx: 0,
    correct: 0,
    total: 0,
    streakNow: 0,
    repeated: {},
    missed: [],
    queue: q,
    revealed: false,
    seenOnce: false,
    dir: 't2s',
    hints: 0,
    tempAnswer: '',
  };
}

/** Tạo session cho game chọn (synonym/antonym) — 4 đáp án */
export function startChoiceSession(
  type: 'synonym' | 'antonym',
  pool: WordEntry[],
  qty: number,
): GameSession {
  const key = type === 'synonym' ? 'synonyms' : 'antonyms';
  const eligible = pool.filter((e) => (e[key] || []).length > 0);
  let q = shuffle(eligible);
  if (qty > 0 && q.length > qty) q = q.slice(0, qty);
  return {
    type,
    idx: 0,
    correct: 0,
    total: 0,
    streakNow: 0,
    repeated: {},
    missed: [],
    key,
    queue: q,
  };
}

/** Trả lời sai → đưa từ về cuối hàng đợi (tối đa 1 lần lặp/từ) */
export function requeueIfWrong(s: GameSession, entry: WordEntry): void {
  const c = s.repeated[entry.id] || 0;
  if (c < 1) {
    s.queue.push(entry);
    s.repeated[entry.id] = c + 1;
  }
}

export function markMissed(s: GameSession, id: string): void {
  if (!s.missed.includes(id)) s.missed.push(id);
}

export function unmarkMissed(s: GameSession, id: string): void {
  s.missed = s.missed.filter((x) => x !== id);
}

/**
 * Xử lý 1 câu trả lời chung (đếm điểm, streak, requeue).
 * Cập nhật session tại chỗ + trả về kết quả.
 */
export function recordAnswer(
  s: GameSession,
  entry: WordEntry,
  isCorrect: boolean,
): { isCorrect: boolean; finished: boolean } {
  s.total++;
  s.streakNow = isCorrect ? (s.streakNow || 0) + 1 : 0;
  if (isCorrect) {
    s.correct++;
    unmarkMissed(s, entry.id);
  } else {
    markMissed(s, entry.id);
    requeueIfWrong(s, entry);
  }
  s.idx++;
  const finished = s.idx >= s.queue.length;
  return { isCorrect, finished };
}

/** Dựng 4 đáp án cho game chọn từ đồng nghĩa/trái nghĩa */
export function buildChoice(
  session: GameSession,
  entries: WordEntry[],
): { entry: WordEntry; correctWord: string; options: string[] } {
  const entry = session.queue[session.idx];
  const key = session.key || 'synonyms';
  const correctWord = shuffle(entry[key] || [])[0];
  const entryPos = entry.senses?.[0]?.partOfSpeech || '';
  const others = entries.filter(
    (e) =>
      e.word.toLowerCase() !== entry.word.toLowerCase() &&
      e.word.toLowerCase() !== correctWord.toLowerCase(),
  );
  let distractorPool = others.filter((e) => e.senses?.[0]?.partOfSpeech === entryPos);
  if (distractorPool.length < 3) distractorPool = others;
  const distractorWords = shuffle(Array.from(new Set(distractorPool.map((e) => e.word)))).slice(
    0,
    3,
  );
  const options = shuffle([correctWord, ...distractorWords]);
  session.current = { entry, correctWord, options };
  return session.current;
}

/** Chuẩn hóa đáp án dịch nghĩa (so khớp từ nguồn / các nghĩa đích / pinyin) */
export function checkTranslate(
  course: Course,
  session: GameSession,
  entry: WordEntry,
  userAnswer: string,
): boolean {
  const dir = session.dir;
  if (dir === 't2s') {
    const okWord = normalize(userAnswer) === normalize(entry.word);
    const okPinyin =
      dir === 't2s' &&
      course.usesPinyin &&
      normPinyinLocal(userAnswer) === normPinyinLocal(entry.senses?.[0]?.pronunciation || '');
    return okWord || okPinyin;
  }
  const targets = entry.senses.map((s) => s.meaning?.[course.target.code] || '');
  return targets.some((a) => normalize(userAnswer) === normalize(a));
}

function normPinyinLocal(str: string): string {
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
  return String(str || '')
    .toLowerCase()
    .replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, (ch) => TONE[ch] || ch)
    .replace(/[^a-z]/g, '');
}
