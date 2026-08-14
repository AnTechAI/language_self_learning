/**
 * learning.ts — Logic học tập THUẦN (port từ legacy learning.js + storage.js).
 * Các hàm chỉ biến đổi dữ liệu (entries/daily) — việc LƯU do store quyết định.
 * Test trong vitest mà không cần DOM/IDB.
 */
import type { WordEntry } from '@english/shared';
import { todayStr } from './format';

export type DailyMap = Record<string, string[]>;

/** Đánh dấu từ đã học hôm nay (new → learning, ghi daily) */
export function applyMarkLearned(
  entries: WordEntry[],
  daily: DailyMap,
  entryId: string,
  today = todayStr(),
) {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return { entries, daily };
  const changed = entry.learningStatus === 'new';
  if (changed) entry.learningStatus = 'learning';
  entry.lastReviewDay = today;
  const list = daily[today] || [];
  if (!list.includes(entryId)) daily[today] = [...list, entryId];
  return { entries, daily };
}

export interface ResultToast {
  kind: 'mastered';
  word: string;
}

/**
 * Ghi nhận kết quả 1 câu trả lời: đúng liên tiếp 3 lần → mastered;
 * sai → reset streak, hạ mastered về learning. new + đúng → tự đánh dấu đã học.
 */
export function applyResult(
  entries: WordEntry[],
  daily: DailyMap,
  entryId: string,
  wasCorrect: boolean,
  today = todayStr(),
): { entries: WordEntry[]; daily: DailyMap; toasts: ResultToast[] } {
  const entry = entries.find((e) => e.id === entryId);
  const toasts: ResultToast[] = [];
  if (!entry) return { entries, daily, toasts };
  entry.correctStreak = entry.correctStreak || 0;
  if (wasCorrect) {
    entry.correctStreak += 1;
    if (entry.learningStatus === 'new') {
      applyMarkLearned(entries, daily, entryId, today);
    } else {
      entry.lastReviewDay = today;
    }
  } else {
    entry.correctStreak = 0;
    if (entry.learningStatus === 'mastered') entry.learningStatus = 'learning';
    entry.lastReviewDay = today;
  }
  if (entry.correctStreak >= 3 && entry.learningStatus !== 'mastered') {
    entry.learningStatus = 'mastered';
    toasts.push({ kind: 'mastered', word: entry.word });
  }
  return { entries, daily, toasts };
}

/** Số ngày liên tiếp tính đến hôm nay (hoặc hôm qua nếu hôm nay chưa học) */
export function computeStreak(daily: DailyMap, today = todayStr()): number {
  const cursor = new Date(today + 'T12:00:00');
  if (!(daily[today] || []).length) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  const key = (d: Date) =>
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0');
  while (daily[key(cursor)] && daily[key(cursor)].length > 0) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Id các từ đã học hôm nay */
export function learnedToday(daily: DailyMap, today = todayStr()): string[] {
  return daily[today] || [];
}

export interface HistoryRec {
  ts: string;
  game: string;
  wordId: string;
  correct: boolean;
}

/** Ghi lịch sử game (giữ tối đa 800 bản ghi) */
export function pushHistory(history: HistoryRec[], rec: HistoryRec): HistoryRec[] {
  const next = [...history, rec];
  return next.length > 800 ? next.slice(next.length - 800) : next;
}
