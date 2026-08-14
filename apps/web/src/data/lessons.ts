/**
 * lessons.ts — Bài học theo nhu cầu (port từ legacy lesson-loader.js).
 * Tải ĐÚNG file bài người dùng chọn; gộp từ vào kho (idempotent, gắn lessonId + tag).
 */
import type { WordEntry } from '@english/shared';
import { initShim, loadScript, once, reg, LEGACY_JS_BASE, type ExtraSeedRow, type LessonMeta } from './registry';
import { toEntry } from './seed';

const pending = new Map<string, Promise<void>>();

/** Tải manifest bài học (nếu chưa có) — trả danh sách bài */
export async function ensureLessonsManifest(): Promise<LessonMeta[]> {
  initShim();
  if (!reg.lessonManifest.length) {
    await once(pending, 'manifest', () =>
      loadScript(LEGACY_JS_BASE + 'lessons/manifest.js').catch(() => {}),
    );
  }
  return reg.lessonManifest;
}

export function lessonById(id: string | null | undefined): LessonMeta | undefined {
  return (reg.lessonManifest || []).find((l) => l.id === id);
}

export type { LessonMeta };

/** Tải file 1 bài — trả {tag, words} (dòng nén) */
export async function loadLesson(id: string): Promise<(LessonMeta & { words: ExtraSeedRow[] }) | null> {
  await ensureLessonsManifest();
  const meta = lessonById(id);
  if (!meta) return null;
  if (!reg.lessons.has(meta.file)) {
    await once(pending, meta.file, () =>
      loadScript(LEGACY_JS_BASE + 'lessons/' + meta.file).catch(() => {}),
    );
  }
  const data = reg.lessons.get(meta.file);
  return { ...meta, words: (data && data.words) || [] };
}

/** Số từ của bài đã có trong kho */
export function lessonWordsInCourse(lessonId: string, entries: WordEntry[]): number {
  const meta = lessonById(lessonId);
  if (!meta) return 0;
  const set = new Set(entries.map((e) => e.word.toLowerCase()));
  const data = reg.lessons.get(meta.file);
  let n = 0;
  ((data && data.words) || []).forEach((r) => {
    if (set.has(String(r[0] || '').toLowerCase())) n++;
  });
  return n;
}

/** Số từ của bài đã HỌC (learning/mastered) */
export function lessonLearnedCount(lessonId: string, entries: WordEntry[]): number {
  return entries.filter((e) => e.lessonId === lessonId && e.learningStatus !== 'new').length;
}

/**
 * Gộp từ của bài vào kho (tự fetch dữ liệu bài khi người dùng chọn bài).
 * Không ghi đè, idempotent; gắn tags=[chủ đề] + lessonId.
 * @returns số từ mới thêm
 */
export async function ensureLessonInCourse(
  lessonId: string,
  entries: WordEntry[],
  save: (entries: WordEntry[]) => Promise<void>,
): Promise<number> {
  const lesson = await loadLesson(lessonId);
  if (!lesson || !lesson.words.length) return 0;
  const existing = new Set(entries.map((e) => e.word.toLowerCase()));
  let added = 0;
  lesson.words.forEach((row) => {
    const w = String(row[0] || '').toLowerCase();
    if (!w || existing.has(w)) return;
    const e = toEntry(row);
    e.tags = [lesson.tag];
    e.lessonId = lesson.id;
    entries.push(e);
    existing.add(w);
    added++;
  });
  if (added) await save(entries);
  return added;
}
