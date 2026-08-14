# IndexedDB — Lớp dữ liệu mới (Giai đoạn 2)

> Thay localStorage bằng IndexedDB cho app React, kèm **migration tự động**
> từ dữ liệu app legacy. Code: `apps/web/src/db/` (`db.ts`, `repo.ts`, `migrate.ts`).

## 1. Làm gì

| File | Nhiệm vụ |
|---|---|
| `db.ts` | Mở database theo version, tạo schema (stores + indexes), tiện ích transaction |
| `repo.ts` | API đọc/ghi có kiểu (Repository pattern) — UI (GĐ 3) chỉ gọi repo này |
| `migrate.ts` | Migration 1 chiều localStorage → IndexedDB, idempotent |
| `db.test.ts` | 12 test (vitest + fake-indexeddb — chạy trên CI, không cần trình duyệt) |

## 2. Lợi ích

- **Dung lượng**: localStorage giới hạn ~5-10MB — không chứa nổi 25MB từ điển
  offline khi port sang React. IndexedDB lên tới hàng trăm MB.
- **Không chặn UI**: đọc/ghi bất đồng bộ (async).
- **Sẵn sàng đồng bộ (GĐ 5)**: mỗi entry là 1 bản ghi kèm `courseId` + `updatedAt`
  → sync per-record, merge theo updatedAt, không ghi đè mù.
- **Migration an toàn**: chạy 1 lần, không mất dữ liệu, không đụng app legacy
  (legacy vẫn dùng localStorage cho đến khi GĐ 3 thay thế hẳn).

## 3. Format — Schema v1

```
DB:  english-learning-db  (version 1)
Store       Key              Index
entries     id               byCourse (courseId) · byUpdatedAt (updatedAt)
daily       [courseId, day]
history     id               byCourse (courseId)
settings    key
meta        key
```

### Bản ghi (record)

```ts
EntryRecord  = WordEntry + { courseId: string; updatedAt: string }   // entries
DailyRecord  = { courseId; day: 'YYYY-MM-DD'; entryIds: string[] }   // daily
HistoryRecord= { id; courseId; ts; game; wordId; correct }           // history
SettingRecord= { key; value }                                        // settings
MetaRecord   = { key; value }                                        // meta
```

- `entries.daily` = 1 record mỗi ngày (daily cũ `{'2025-01-01': [entryId…]}` → tách
  từng ngày 1 record).
- History giữ shape legacy (`ts/game/wordId/correct`) + thêm `id`, `courseId`.
- `getAll` trả theo thứ tự primary key — UI phải tự sort (vd history sort theo `ts`).

## 4. Migration (localStorage → IDB)

Khoá localStorage đọc:

| Khoá | Vào đâu |
|---|---|
| `course_en|zh_{entries,daily,history}` | store entries/daily/history (kèm courseId) |
| `vocab_settings_v1` | store settings (mỗi key 1 record) |
| `vocab_entries_v1\|v2`, `vocab_daily_v2`, `vocab_history_v2` | gộp vào **course_en** nếu khóa en chưa có dữ liệu (giống `VA.importLegacy`) |

Quy tắc:
- **Idempotent**: sau khi chạy, ghi `meta['migrated-from-localstorage']` → lần sau
  bỏ qua ngay.
- **Giữ nguyên entry id** — daily/history vẫn trỏ đúng entry.
- **Không ghi đè**: khóa nào đã có dữ liệu trong localStorage thì khóa đó được
  migrate; dữ liệu cũ `vocab_*` chỉ gộp khi course_en trống.
- `repo.entries.list()` **strip** courseId/updatedAt — UI chỉ thấy `WordEntry`.

## 5. API (repo)

```ts
repo.entries.list(courseId) | upsert(entry, courseId) | replaceAll(courseId, entries[]) | remove(courseId, id)
repo.daily.get(courseId, day) | put(courseId, day, entryIds[]) | replaceAll(courseId, map) | list(courseId)
repo.history.list(courseId) | push(courseId, rec) | replaceAll(courseId, records[])
repo.settings.get() | put(settingsObj)
repo.meta.get(key) | set(key, value)
repo.close()          // đóng connection (test)
```

Ngữ nghĩa `replaceAll` giống legacy: xóa hết bản ghi của khóa rồi ghi lại —
port màn hình không phải đổi logic. Thực thi bằng **2 transaction** (xóa rồi ghi).

> ⚠️ Cách xóa: **getAllKeys → delete từng key đồng loạt**, KHÔNG dùng cursor.
> `cursor.delete()` chạy trong callback onsuccess — mỗi bước cursor là 1 tick,
> transaction rơi về inactive giữa các bước → `InvalidStateError` khi có
> transaction khác xen vào (fake-indexeddb: lỗi thật; trình duyệt: rủi ro tương
> tự). Delete đồng loạt chạy trong 1 pass — an toàn mọi môi trường.

## 6. Test

```bash
npm run test:react          # vitest: src/db/db.test.ts — 12 test
```

- Dùng `fake-indexeddb/auto` → chạy trên Node/CI không cần trình duyệt.
- Mỗi test: xóa DB (retry khi bị block do connection cũ) + đóng connection
  trong afterEach.

## 7. Lưu ý khi chuyển đổi

- Trong giai đoạn GĐ 2→3, app legacy (localStorage) và app React (IDB) có thể chạy
  song song nhưng **trên 2 origin khác nhau** (file:// vs localhost) — dữ liệu tách
  biệt, không xung đột. Không nên dùng đồng thời cả hai trên CÙNG một origin để học
  thật (dữ liệu sẽ lệch nhau) — app React chưa có màn hình nên không sao.
- Migration chỉ chạy ở app React; legacy không bị đụng.
