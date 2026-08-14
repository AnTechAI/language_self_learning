/**
 * migrate.ts — Migration localStorage → IndexedDB (Giai đoạn 2).
 *
 * LÀM GÌ:
 *   Đọc dữ liệu hiện có trong localStorage của app legacy
 *   (course_{id}_entries/_daily/_history + vocab_settings_v1 + các key cũ v1/v2)
 *   và ghi sang IndexedDB qua repo. Chạy 1 lần — đánh dấu hoàn tất trong store
 *   `meta` → lần sau bỏ qua (idempotent).
 *
 * LỢI ÍCH:
 *   - Người dùng không mất gì khi chuyển sang app React (GĐ 3): dữ liệu học,
 *     streak, lịch sử tự động kế thừa.
 *   - Chạy lại an toàn: nếu đã migrate thì không đụng vào dữ liệu.
 *
 * FORMAT (xem docs/INDEXEDDB.md):
 *   Khoá localStorage đọc:
 *     course_en|zh_{entries,daily,history}   (database từng khóa học)
 *     vocab_settings_v1                      (cài đặt toàn cục)
 *     vocab_entries_v1|v2, vocab_daily_v2, vocab_history_v2  (dữ liệu app cũ
 *       → gộp vào course_en nếu khóa en chưa có dữ liệu)
 */
import type { HistoryRecord as LegacyHistory, Settings, WordEntry } from '@english/shared';
import { createRepo, type MigrationSummary, type Repo } from './repo';

export const COURSE_IDS = ['en', 'zh'] as const;
export const SETTINGS_KEY = 'vocab_settings_v1';

export interface StorageLike {
  getItem(key: string): string | null;
}

export interface MigrateDeps {
  storage?: StorageLike;
  repo?: Repo;
}

interface RawCourse {
  entries: WordEntry[];
  daily: Record<string, string[]>;
  history: LegacyHistory[];
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readCourse(storage: StorageLike, courseId: string): RawCourse | null {
  const p = `course_${courseId}`;
  const entries = safeParse<WordEntry[]>(storage.getItem(`${p}_entries`));
  if (entries === null) return null; // khóa chưa từng có dữ liệu
  const daily = safeParse<Record<string, string[]>>(storage.getItem(`${p}_daily`)) ?? {};
  const history = safeParse<LegacyHistory[]>(storage.getItem(`${p}_history`)) ?? [];
  return { entries, daily, history };
}

/** Đọc key cũ (vocab_* v1/v2) nếu khóa en chưa có dữ liệu — giống VA.importLegacy */
function readLegacy(storage: StorageLike): RawCourse {
  const entries =
    safeParse<WordEntry[]>(storage.getItem('vocab_entries_v2')) ??
    safeParse<WordEntry[]>(storage.getItem('vocab_entries_v1')) ??
    [];
  const daily = safeParse<Record<string, string[]>>(storage.getItem('vocab_daily_v2')) ?? {};
  const history = safeParse<LegacyHistory[]>(storage.getItem('vocab_history_v2')) ?? [];
  return { entries, daily, history };
}

/**
 * Migration chính. Idempotent: nếu meta.migrated đã tồn tại → trả ngay.
 */
export async function migrateIfNeeded(deps: MigrateDeps = {}): Promise<MigrationSummary> {
  const storage = deps.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const repo = deps.repo ?? createRepo();
  const empty: MigrationSummary = {
    alreadyDone: true,
    courses: [],
    settings: false,
    legacyFolded: 0,
  };

  if (!storage) return empty;

  const done = await repo.meta.get('migrated-from-localstorage');
  if (done) {
    const prev = done as Partial<MigrationSummary>;
    // KHÔNG spread toàn bộ prev (nó chứa alreadyDone:false của lần đầu)
    return {
      alreadyDone: true,
      courses: prev.courses ?? [],
      settings: prev.settings ?? false,
      legacyFolded: prev.legacyFolded ?? 0,
    };
  }

  const summary: MigrationSummary = {
    alreadyDone: false,
    courses: [],
    settings: false,
    legacyFolded: 0,
  };

  for (const courseId of COURSE_IDS) {
    let raw = readCourse(storage, courseId);
    let folded = false;
    if (!raw && courseId === 'en') {
      const legacy = readLegacy(storage);
      if (legacy.entries.length) {
        raw = legacy;
        folded = true;
      }
    }
    if (!raw) continue;

    await repo.entries.replaceAll(courseId, raw.entries);
    await repo.daily.replaceAll(courseId, raw.daily);
    await repo.history.replaceAll(
      courseId,
      raw.history.map((h) => ({ ...h, id: uid() })),
    );
    summary.courses.push({
      courseId,
      entries: raw.entries.length,
      daily: Object.keys(raw.daily).length,
      history: raw.history.length,
    });
    if (folded) summary.legacyFolded += raw.entries.length;
  }

  const settings = safeParse<Settings>(storage.getItem(SETTINGS_KEY));
  if (settings && Object.keys(settings).length) {
    await repo.settings.put(settings);
    summary.settings = true;
  }

  await repo.meta.set('migrated-from-localstorage', { at: new Date().toISOString(), ...summary });
  return summary;
}

/** id ngẫu nhiên cho bản ghi history (đủ dùng, không cần timestamp đẹp) */
function uid(): string {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
