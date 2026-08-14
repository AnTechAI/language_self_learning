/**
 * db.ts — Lớp IndexedDB (Giai đoạn 2).
 *
 * LÀM GÌ:
 *   Thay localStorage bằng IndexedDB cho app React. Mở database theo phiên bản
 *   (schema version), tạo object stores, cung cấp tiện ích giao dịch (tx).
 *
 * LỢI ÍCH:
 *   - Dung lượng lớn (500MB+) — localStorage chỉ 5-10MB, không đủ cho 25MB từ điển
 *     offline khi port sang React.
 *   - Không đồng bộ (async) — không chặn UI.
 *   - Từng entry là 1 bản ghi (kèm courseId + updatedAt) → sẵn sàng đồng bộ GĐ 5
 *     (sync per-record, merge theo updatedAt).
 *
 * FORMAT (schema v1 — xem thêm docs/INDEXEDDB.md):
 *   DB:  english-learning-db
 *   Store       Key             Index
 *   entries     id              byCourse (courseId), byUpdatedAt (updatedAt)
 *   daily       [courseId, day]
 *   history     id              byCourse (courseId)
 *   settings    key             —
 *   meta        key             —
 */
import type { WordEntry } from '@english/shared';

export const DB_NAME = 'english-learning-db';
export const DB_VERSION = 1;

/** Bản ghi entry trong IDB = WordEntry + courseId + updatedAt (để sync) */
export interface EntryRecord extends WordEntry {
  courseId: string;
  updatedAt: string;
}

/** 1 ngày học của 1 khóa (daily cũ: { 'YYYY-MM-DD': [entryId…] }) */
export interface DailyRecord {
  courseId: string;
  day: string;
  entryIds: string[];
}

/** 1 bản ghi lịch sử game (giữ nguyên shape legacy: ts/game/wordId/correct) */
export interface HistoryRecord {
  id: string;
  courseId: string;
  ts: string;
  game: string;
  wordId: string;
  correct: boolean;
}

/** Cài đặt toàn cục (1 dòng 1 key) */
export interface SettingRecord {
  key: string;
  value: unknown;
}

/** Metadata (vd: đã migrate từ localStorage chưa) */
export interface MetaRecord {
  key: string;
  value: unknown;
}

function createSchema(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains('entries')) {
    const s = db.createObjectStore('entries', { keyPath: 'id' });
    s.createIndex('byCourse', 'courseId');
    s.createIndex('byUpdatedAt', 'updatedAt');
  }
  if (!db.objectStoreNames.contains('daily')) {
    db.createObjectStore('daily', { keyPath: ['courseId', 'day'] });
  }
  if (!db.objectStoreNames.contains('history')) {
    const s = db.createObjectStore('history', { keyPath: 'id' });
    s.createIndex('byCourse', 'courseId');
  }
  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains('meta')) {
    db.createObjectStore('meta', { keyPath: 'key' });
  }
}

/** Mở database (tạo schema nếu chưa có). Inject factory để test (fake-indexeddb). */
export function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => createSchema(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Bọc 1 IDBRequest → Promise */
function toPromise<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/**
 * Chạy 1 transaction. fn nhận object store và trả về các request.
 * Trả về mảng KẾT QUẢ của từng request (mỗi phần tử = result của 1 request).
 * Chú ý: gọi 1 request thì destructure `const [x] = await runTx(...)`.
 */
export async function runTx(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest | IDBRequest[],
): Promise<unknown[]> {
  const t = db.transaction(store, mode);
  // Gắn handler hoàn tất NGAY — không đợi các request riêng lẻ (tránh race).
  // oncomplete chỉ bắn khi mọi request trong transaction (kể cả vòng lặp
  // cursor) đã xong → mọi thao tác xóa/ghi trong tx đều được chờ.
  const done = new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onabort = () => reject(t.error);
    t.onerror = () => reject(t.error);
  });
  const reqs = fn(t.objectStore(store));
  const list = Array.isArray(reqs) ? reqs : [reqs];
  const results = await Promise.all(list.map((r) => toPromise(r)));
  await done;
  return results as unknown[];
}
