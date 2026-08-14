/**
 * db.test.ts — Test lớp IndexedDB (GĐ 2) bằng vitest + fake-indexeddb.
 *
 * fake-indexeddb/auto gắn `indexedDB` toàn cục giống trình duyệt →
 * chạy trên Node (CI) mà không cần trình duyệt.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Settings, WordEntry } from '@english/shared';
import { createRepo, type Repo } from './repo';
import { migrateIfNeeded } from './migrate';
import { DB_NAME, openDb } from './db';
import type { StorageLike } from './migrate';

const SENSE = {
  pronunciation: '/həˈloʊ/',
  partOfSpeech: 'interjection',
  meaning: { en: 'Greeting.', vi: 'Xin chào.' },
  examples: ['Hello world!'],
};

function makeEntry(word: string, id: string): WordEntry {
  return {
    id,
    word,
    tags: ['đời sống'],
    dateAdded: '2025-01-01T00:00:00.000Z',
    learningStatus: 'new',
    correctStreak: 0,
    synonyms: [],
    antonyms: [],
    wordRoot: '',
    senses: [SENSE],
  };
}

function clearDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    // Connection cũ chưa đóng kịp → bị block: đợi rồi thử lại
    req.onblocked = () => setTimeout(() => clearDb().then(resolve, reject), 20);
  });
}

/** Storage giả cho migration (thay window.localStorage) */
function fakeStorage(init: Record<string, string> = {}): StorageLike & {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
} {
  const map = new Map(Object.entries(init));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

let repo: Repo;
beforeEach(async () => {
  await clearDb();
  repo = createRepo();
});
afterEach(async () => {
  await repo.close();
});

describe('openDb — schema v1', () => {
  it('tạo đủ 5 stores', async () => {
    const db = await openDb();
    expect(db.objectStoreNames.contains('entries')).toBe(true);
    expect(db.objectStoreNames.contains('daily')).toBe(true);
    expect(db.objectStoreNames.contains('history')).toBe(true);
    expect(db.objectStoreNames.contains('settings')).toBe(true);
    expect(db.objectStoreNames.contains('meta')).toBe(true);
    db.close();
  });

  it('tạo index byCourse/byUpdatedAt trên entries', async () => {
    const db = await openDb();
    const t = db.transaction('entries', 'readonly');
    expect(t.objectStore('entries').indexNames.contains('byCourse')).toBe(true);
    expect(t.objectStore('entries').indexNames.contains('byUpdatedAt')).toBe(true);
    db.close();
  });
});

describe('repo.entries', () => {
  it('replaceAll + list roundtrip (strip courseId/updatedAt, lọc theo khóa)', async () => {
    await repo.entries.replaceAll('en', [makeEntry('hello', 'a'), makeEntry('world', 'b')]);
    await repo.entries.replaceAll('zh', [makeEntry('nihao', 'c')]);

    const en = await repo.entries.list('en');
    expect(en.map((e) => e.word).sort()).toEqual(['hello', 'world']);
    expect(en[0]).not.toHaveProperty('courseId');
    expect(en[0]).not.toHaveProperty('updatedAt');

    const zh = await repo.entries.list('zh');
    expect(zh.map((e) => e.word)).toEqual(['nihao']);
  });

  it('upsert thêm/sửa entry, remove xóa entry', async () => {
    const e = makeEntry('hello', 'a');
    await repo.entries.upsert(e, 'en');
    let list = await repo.entries.list('en');
    expect(list).toHaveLength(1);

    await repo.entries.upsert({ ...e, correctStreak: 2 }, 'en');
    list = await repo.entries.list('en');
    expect(list[0].correctStreak).toBe(2);

    await repo.entries.remove('en', 'a');
    list = await repo.entries.list('en');
    expect(list).toHaveLength(0);
  });
});

describe('repo.daily', () => {
  it('put/get + replaceAll + list', async () => {
    await repo.daily.put('en', '2025-01-01', ['a', 'b']);
    expect(await repo.daily.get('en', '2025-01-01')).toEqual(['a', 'b']);
    expect(await repo.daily.get('en', '2025-01-02')).toEqual([]);

    await repo.daily.replaceAll('en', { '2025-01-01': ['a'], '2025-01-02': ['b', 'c'] });
    const recs = await repo.daily.list('en');
    expect(recs).toHaveLength(2);
    expect(recs[1].day).toBe('2025-01-02');

    // Khóa khác không bị đụng
    await repo.daily.put('zh', '2025-01-03', ['x']);
    const recsZh = await repo.daily.list('zh');
    expect(recsZh).toHaveLength(1);
  });
});

describe('repo.history', () => {
  it('push + list theo khóa, replaceAll xóa cũ của khóa', async () => {
    await repo.history.push('en', {
      ts: '2025-01-01T00:00:00Z',
      game: 'flashcard',
      wordId: 'a',
      correct: true,
    });
    await repo.history.push('en', {
      ts: '2025-01-01T00:01:00Z',
      game: 'translate',
      wordId: 'b',
      correct: false,
    });
    await repo.history.push('zh', {
      ts: '2025-01-01T00:02:00Z',
      game: 'flashcard',
      wordId: 'x',
      correct: true,
    });

    const en = await repo.history.list('en');
    expect(en).toHaveLength(2);
    // getAll trả theo thứ tự id (ngẫu nhiên) — UI tự sort theo ts nên test
    // sort lại để không phụ thuộc thứ tự lưu.
    const byTs = [...en].sort((a, b) => a.ts.localeCompare(b.ts));
    expect(byTs[0]).toMatchObject({ game: 'flashcard', wordId: 'a', correct: true });
    expect(byTs[0]).toHaveProperty('id');
    expect(byTs[0]).toHaveProperty('courseId', 'en');

    const zh = await repo.history.list('zh');
    expect(zh).toHaveLength(1);
  });
});

describe('repo.settings + meta', () => {
  it('put/get settings', async () => {
    const s: Settings = { courseId: 'en', gameQty: 20, seedVersion: 2 };
    await repo.settings.put(s);
    const got = await repo.settings.get();
    expect(got).toMatchObject({ courseId: 'en', gameQty: 20, seedVersion: 2 });
  });

  it('meta set/get', async () => {
    await repo.meta.set('flag', { ok: 1 });
    expect(await repo.meta.get('flag')).toEqual({ ok: 1 });
    expect(await repo.meta.get('nope')).toBeUndefined();
  });
});

describe('migrateIfNeeded', () => {
  const entryJson = JSON.stringify(makeEntry('hello', 'legacy-id'));

  it('localStorage trống → summary rỗng + đánh dấu đã migrate (idempotent)', async () => {
    const storage = fakeStorage();
    const s1 = await migrateIfNeeded({ storage, repo });
    expect(s1.alreadyDone).toBe(false);
    expect(s1.courses).toEqual([]);
    expect(s1.settings).toBe(false);

    const s2 = await migrateIfNeeded({ storage, repo });
    expect(s2.alreadyDone).toBe(true);
  });

  it('migrate course_en/zh: entries giữ id, daily, history + settings', async () => {
    const storage = fakeStorage({
      course_en_entries: `[${entryJson}]`,
      course_en_daily: JSON.stringify({ '2025-01-01': ['legacy-id'] }),
      course_en_history: JSON.stringify([
        { ts: '2025-01-01T00:00:00Z', game: 'flashcard', wordId: 'legacy-id', correct: true },
      ]),
      course_zh_entries: JSON.stringify([makeEntry('nihao', 'zh-id')]),
      vocab_settings_v1: JSON.stringify({ courseId: 'en', gameQty: 20 }),
    });

    const s = await migrateIfNeeded({ storage, repo });
    expect(s.courses).toHaveLength(2);
    expect(s.settings).toBe(true);

    const en = await repo.entries.list('en');
    expect(en).toHaveLength(1);
    expect(en[0].id).toBe('legacy-id'); // giữ nguyên id — daily/history vẫn trỏ đúng
    expect(await repo.daily.get('en', '2025-01-01')).toEqual(['legacy-id']);
    const h = await repo.history.list('en');
    expect(h).toHaveLength(1);
    expect(h[0].wordId).toBe('legacy-id');

    const zh = await repo.entries.list('zh');
    expect(zh.map((e) => e.word)).toEqual(['nihao']);

    const settings = await repo.settings.get();
    expect(settings.courseId).toBe('en');
  });

  it('gộp key cũ vocab_* vào course_en khi khóa en chưa có dữ liệu', async () => {
    const storage = fakeStorage({
      vocab_entries_v2: `[${entryJson}]`,
      vocab_daily_v2: JSON.stringify({ '2024-12-31': ['legacy-id'] }),
    });

    const s = await migrateIfNeeded({ storage, repo });
    expect(s.legacyFolded).toBe(1);
    const en = await repo.entries.list('en');
    expect(en.map((e) => e.word)).toEqual(['hello']);
    expect(await repo.daily.get('en', '2024-12-31')).toEqual(['legacy-id']);
  });

  it('nếu course_en đã có dữ liệu thì không gộp vocab_* cũ (không ghi đè)', async () => {
    const storage = fakeStorage({
      course_en_entries: `[${JSON.stringify(makeEntry('hello', 'new-id'))}]`,
      vocab_entries_v2: `[${entryJson}]`,
    });

    const s = await migrateIfNeeded({ storage, repo });
    expect(s.legacyFolded).toBe(0);
    const en = await repo.entries.list('en');
    expect(en.map((e) => e.id)).toEqual(['new-id']);
  });
});
