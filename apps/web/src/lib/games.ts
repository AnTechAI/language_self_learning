/**
 * games.ts — Logic game THUẦN (port từ legacy ui-games.js).
 * Tách phần biến đổi dữ liệu khỏi phần render → test được, UI (React) chỉ render.
 */
import type { Course, Sense, WordEntry } from '@english/shared';
import { hasTarget, normalize, shuffle } from './format';

export type GameType = 'flashcard' | 'translate-en' | 'translate-vi' | 'synonym' | 'antonym';

export interface GameSession {
  type: GameType;
  idx: number;
  correct: number;
  total: number;
  streakNow: number;
  repeated: Record<string, number>;
  missed: string[];
  queue: WordEntry[];
  /** Nguồn từ vựng cho game chọn (đồng/trái nghĩa) — giữ phạm vi bài học */
  pool?: WordEntry[];
  key?: 'synonyms' | 'antonyms';
  /** Sense CỐ ĐỊNH cho từng từ trong cả phiên (flashcard/translate) */
  senseIdx?: Record<string, number>;
  // flashcard
  revealed?: boolean;
  seenOnce?: boolean;
  // translate: 2 game riêng (translate-en / translate-vi) — không còn dir qua-lại
  hints?: number;
  tempAnswer?: string;
  // choice game (synonym/antonym)
  current?: { entry: WordEntry; correctWord: string; options: string[] };
  // kết quả câu vừa trả lời (choice/translate) để render feedback
  answered?: boolean;
  lastAnswer?: { chosen: string; correctWord: string; isCorrect: boolean; word?: string };
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

/** Tạo session ban đầu cho game loại thường (flashcard/translate).
 *  Khóa sense cố định cho từng từ (ưu tiên sense có nghĩa đích nếu có targetCode)
 *  → hiển thị + validate dùng ĐÚNG 1 sense, không đổi giữa chừng. */
export function startSimpleSession(
  type: 'flashcard' | 'translate-en' | 'translate-vi',
  pool: WordEntry[],
  qty: number,
  targetCode?: string,
): GameSession {
  let q = shuffle(pool);
  if (qty > 0 && q.length > qty) q = q.slice(0, qty);
  const senseIdx: Record<string, number> = {};
  q.forEach((e) => {
    const arr = e.senses || [];
    const withTarget = targetCode ? arr.filter((s) => s.meaning?.[targetCode]) : arr;
    const cands = withTarget.length ? withTarget : arr;
    const pick = cands[Math.floor(Math.random() * cands.length)];
    senseIdx[e.id] = pick ? arr.indexOf(pick) : 0;
  });
  return {
    type,
    idx: 0,
    correct: 0,
    total: 0,
    streakNow: 0,
    repeated: {},
    missed: [],
    senseIdx,
    queue: q,
    revealed: false,
    seenOnce: false,
    hints: 0,
    tempAnswer: '',
  };
}

/** Sense CỐ ĐỊNH của từ trong phiên (không đổi khi re-render). */
export function stableSense(entry: WordEntry, s: GameSession): Sense | undefined {
  const arr = entry.senses || [];
  if (!arr.length) return undefined;
  const i = s.senseIdx?.[entry.id];
  if (typeof i === 'number' && arr[i]) return arr[i];
  return arr[0];
}

/** Tạo session cho game chọn (synonym/antonym) — 4 đáp án */
export function startChoiceSession(
  type: 'synonym' | 'antonym',
  pool: WordEntry[],
  qty: number,
): GameSession {
  const key = type === 'synonym' ? 'synonyms' : 'antonyms';
  // Chỉ giữ từ có ÍT NHẤT 1 đáp án không rỗng
  const eligible = pool.filter((e) => (e[key] || []).some((w) => w && w.trim()));
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
    pool: pool.slice(),
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
  distractorSource?: WordEntry[],
): { entry: WordEntry; correctWord: string; options: string[] } {
  const entry = session.queue[session.idx];
  const key = session.key || 'synonyms';
  const cands = (entry[key] || []).filter((w) => w && w.trim());
  const correctWord = shuffle(cands)[0] || '';
  const entryPos = entry.senses?.[0]?.partOfSpeech || '';
  // Dùng nguồn nhiễu của bài học khi nó đủ từ khác (≥3) — giữ phạm vi bài
  let src = entries;
  if (distractorSource) {
    const othersInScope = distractorSource.filter(
      (e) =>
        e.word.toLowerCase() !== entry.word.toLowerCase() &&
        e.word.toLowerCase() !== correctWord.toLowerCase(),
    );
    if (othersInScope.length >= 3) src = distractorSource;
  }
  const others = src.filter(
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

/** Mã ngôn ngữ đích của game dịch: translate-en → từ vựng (không cần mã),
 *  translate-vi → nghĩa tiếng Việt (course.target.code). */
export function translateTargetCode(course: Course, type: GameType): string {
  return type === 'translate-en' ? 'en' : course.target.code;
}

/** Kiểm tra đáp án game dịch — validate ĐÚNG sense đang hiển thị (stableSense).
 *  Luôn theo nội dung game: translate-en HIỆN định nghĩa tiếng Anh → người chơi
 *  GÕ TỪ VỰNG; translate-vi HIỆN từ → gõ nghĩa tiếng Việt.
 *  Nghĩa: chấp nhận nguyên cả nghĩa HOẶC 1 phần tách , ; ，、 (vd "làm, thực hiện"). */
export function checkTranslate(
  course: Course,
  session: GameSession,
  entry: WordEntry,
  userAnswer: string,
): boolean {
  const norm = normalize(userAnswer);
  if (!norm) return false;
  if (session.type === 'translate-en') {
    // Đáp án là TỪ VỰNG (không phân biệt hoa thường)
    return norm === normalize(entry.word);
  }
  const sense = stableSense(entry, session);
  if (!sense) return false;
  const code = translateTargetCode(course, session.type);
  const target = sense.meaning?.[code] || '';
  if (normalize(target) === norm) return true;
  return String(target)
    .split(/[,;，、]/)
    .some((part) => normalize(part) === norm);
}
