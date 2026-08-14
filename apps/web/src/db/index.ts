/**
 * db/index.ts — API công khai của lớp dữ liệu (GĐ 2).
 * GĐ 3 các màn hình import từ đây: `import { repo, migrateIfNeeded } from './db'`.
 */
export { createRepo } from './repo';
export type { MigrationSummary, Repo } from './repo';
export { migrateIfNeeded, COURSE_IDS, SETTINGS_KEY } from './migrate';
export type { MigrateDeps, StorageLike } from './migrate';
export { openDb, DB_NAME, DB_VERSION } from './db';
export type { DailyRecord, EntryRecord, HistoryRecord, MetaRecord, SettingRecord } from './db';
