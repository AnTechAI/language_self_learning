/**
 * repo.ts — Repository pattern trên IndexedDB (Giai đoạn 2).
 *
 * LÀM GÌ:
 *   API đọc/ghi CÓ KIỂU cho dữ liệu học tập, thay cho đọc/ghi localStorage
 *   của app legacy. UI (GĐ 3) chỉ gọi repo này — không biết dữ liệu nằm ở đâu.
 *
 * LỢI ÍCH:
 *   - Một chỗ duy nhất đụng vào DB → đổi lưu trữ không phải sửa UI.
 *   - Ngữ nghĩa giống legacy (replaceAll = lưu toàn bộ danh sách) để port
 *     màn hình không phải đổi logic.
 *   - Entry được lưu KÈM courseId + updatedAt → nền tảng cho đồng bộ (GĐ 5).
 *
 * FORMAT (xem docs/INDEXEDDB.md):
 *   repo = createRepo([factory]) → { entries, daily, history, settings, meta }
 */
import type { Settings, WordEntry } from '@english/shared';
import {
  openDb,
  runTx,
  type DailyRecord,
  type EntryRecord,
  type HistoryRecord,
  type MetaRecord,
  type SettingRecord,
} from './db';

export interface MigrationSummary {
  alreadyDone: boolean;
  courses: { courseId: string; entries: number; daily: number; history: number }[];
  settings: boolean;
  legacyFolded: number;
}

export interface Repo {
  entries: {
    list(courseId: string): Promise<WordEntry[]>;
    upsert(entry: WordEntry, courseId: string, updatedAt?: string): Promise<void>;
    replaceAll(courseId: string, entries: WordEntry[]): Promise<void>;
    remove(courseId: string, id: string): Promise<void>;
  };
  daily: {
    get(courseId: string, day: string): Promise<string[]>;
    put(courseId: string, day: string, entryIds: string[]): Promise<void>;
    replaceAll(courseId: string, map: Record<string, string[]>): Promise<void>;
    list(courseId: string): Promise<DailyRecord[]>;
  };
  history: {
    list(courseId: string): Promise<HistoryRecord[]>;
    push(courseId: string, rec: Omit<HistoryRecord, 'id' | 'courseId'>): Promise<void>;
    replaceAll(courseId: string, records: Omit<HistoryRecord, 'courseId'>[]): Promise<void>;
  };
  settings: {
    get(): Promise<Settings>;
    put(obj: Settings): Promise<void>;
  };
  meta: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  /** Đóng connection (dùng trong test để xóa DB — tránh bị block) */
  close(): Promise<void>;
}

/** Tạo repo gắn với 1 factory (mặc định: indexedDB của trình duyệt). */
export function createRepo(factory: IDBFactory = indexedDB): Repo {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = (): Promise<IDBDatabase> => {
    dbPromise = dbPromise ?? openDb(factory);
    return dbPromise;
  };

  return {
    entries: {
      async list(courseId) {
        const d = await db();
        const [all] = (await runTx(d, 'entries', 'readonly', (s) =>
          s.index('byCourse').getAll(courseId),
        )) as [EntryRecord[]];
        return all.map((r) => strip(r));
      },
      async upsert(entry, courseId, updatedAt = new Date().toISOString()) {
        const d = await db();
        await runTx(d, 'entries', 'readwrite', (s) =>
          s.put({ ...entry, courseId, updatedAt } satisfies EntryRecord),
        );
      },
      async replaceAll(courseId, entries) {
        const d = await db();
        // TX 1: xóa toàn bộ entry cũ của khóa. KHÔNG dùng cursor (bước qua
        // nhiều tick → transaction bị inactive khi xóa, lỗi InvalidStateError
        // ở fake-indexeddb khi có tx khác xen vào). Dùng getAllKeys rồi xóa
        // đồng loạt trong 1 pass — đơn giản, an toàn ở mọi môi trường.
        const [keys] = (await runTx(d, 'entries', 'readonly', (s) =>
          s.index('byCourse').getAllKeys(courseId),
        )) as [IDBValidKey[]];
        if (keys.length) {
          await runTx(d, 'entries', 'readwrite', (s) => keys.map((k) => s.delete(k)));
        }
        // TX 2: ghi lại toàn bộ (ngữ nghĩa replaceAll giống legacy)
        if (entries.length) {
          const updatedAt = new Date().toISOString();
          await runTx(d, 'entries', 'readwrite', (s) =>
            entries.map((e) => s.put({ ...e, courseId, updatedAt } satisfies EntryRecord)),
          );
        }
      },
      async remove(_courseId, id) {
        const d = await db();
        await runTx(d, 'entries', 'readwrite', (s) => s.delete(id));
      },
    },

    daily: {
      async get(courseId, day) {
        const d = await db();
        const [rec] = (await runTx(d, 'daily', 'readonly', (s) =>
          s.get([courseId, day] as IDBValidKey),
        )) as [DailyRecord | undefined];
        return rec?.entryIds ?? [];
      },
      async put(courseId, day, entryIds) {
        const d = await db();
        await runTx(d, 'daily', 'readwrite', (s) =>
          s.put({ courseId, day, entryIds } satisfies DailyRecord),
        );
      },
      async replaceAll(courseId, map) {
        const d = await db();
        const recs: DailyRecord[] = Object.entries(map).map(([day, entryIds]) => ({
          courseId,
          day,
          entryIds,
        }));
        // TX 1: xóa bản ghi cũ của khóa (getAllKeys thay cursor — an toàn)
        const [keys] = (await runTx(d, 'daily', 'readonly', (s) => s.getAllKeys())) as [
          IDBValidKey[],
        ];
        const stale = keys.filter((k) => {
          const kv = k as unknown as [string, string];
          return Array.isArray(kv) && kv[0] === courseId;
        });
        if (stale.length) {
          await runTx(d, 'daily', 'readwrite', (s) => stale.map((k) => s.delete(k)));
        }
        // TX 2: ghi bản ghi mới
        if (recs.length) {
          await runTx(d, 'daily', 'readwrite', (s) =>
            recs.map((r) => s.put(r satisfies DailyRecord)),
          );
        }
      },
      async list(courseId) {
        const d = await db();
        const [all] = (await runTx(d, 'daily', 'readonly', (s) => s.getAll())) as [DailyRecord[]];
        return all.filter((r) => r.courseId === courseId);
      },
    },

    history: {
      async list(courseId) {
        const d = await db();
        const [all] = (await runTx(d, 'history', 'readonly', (s) =>
          s.index('byCourse').getAll(courseId),
        )) as [HistoryRecord[]];
        return all;
      },
      async push(courseId, rec) {
        const d = await db();
        const id = `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        await runTx(d, 'history', 'readwrite', (s) =>
          s.put({ id, courseId, ...rec } satisfies HistoryRecord),
        );
      },
      async replaceAll(courseId, records: Omit<HistoryRecord, 'courseId'>[]) {
        const d = await db();
        // TX 1: xóa bản ghi cũ của khóa (getAllKeys thay cursor — an toàn)
        const [keys] = (await runTx(d, 'history', 'readonly', (s) =>
          s.index('byCourse').getAllKeys(courseId),
        )) as [IDBValidKey[]];
        if (keys.length) {
          await runTx(d, 'history', 'readwrite', (s) => keys.map((k) => s.delete(k)));
        }
        // TX 2: ghi bản ghi mới
        if (records.length) {
          await runTx(d, 'history', 'readwrite', (s) =>
            records.map((r) => s.put({ ...r, courseId } satisfies HistoryRecord)),
          );
        }
      },
    },

    settings: {
      async get() {
        const d = await db();
        const [recs] = (await runTx(d, 'settings', 'readonly', (s) => s.getAll())) as [
          SettingRecord[],
        ];
        const out: Settings = {};
        recs.forEach((r) => {
          if (r) out[r.key] = r.value;
        });
        return out;
      },
      async put(obj) {
        const d = await db();
        await runTx(d, 'settings', 'readwrite', (s) => {
          const reqs = Object.entries(obj).map(([key, value]) => s.put({ key, value }));
          return reqs;
        });
      },
    },

    meta: {
      async get(key) {
        const d = await db();
        const [rec] = (await runTx(d, 'meta', 'readonly', (s) => s.get(key))) as [
          MetaRecord | undefined,
        ];
        return rec?.value;
      },
      async set(key, value) {
        const d = await db();
        await runTx(d, 'meta', 'readwrite', (s) => s.put({ key, value }));
      },
    },

    close: async () => {
      if (dbPromise) {
        const d = await dbPromise;
        d.close();
        dbPromise = null;
      }
    },
  };
}

/** Bỏ courseId/updatedAt khi trả entry ra ngoài (UI chỉ thấy WordEntry) */
function strip(r: EntryRecord): WordEntry {
  const { courseId, updatedAt, ...entry } = r;
  void courseId;
  void updatedAt;
  return entry;
}
