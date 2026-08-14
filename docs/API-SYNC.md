# API FastAPI + Đồng bộ — `apps/api/`

## 1. Làm gì (GĐ 5)

Cho phép **share app cho bạn bè**: mỗi người tài khoản riêng, dữ liệu học tập
(từ vựng, streak, lịch sử game) đồng bộ lên server → dùng trên nhiều thiết bị,
không mất khi đổi máy. Ngoài ra: proxy Free Dictionary API (chống rate-limit/CORS, có cache).

## 2. Lợi ích

- **Đa người dùng** — hiện app chỉ lưu local, đổi máy là mất hết.
- **Backup tự động** — dữ liệu học là của người dùng, không thể mất.
- **API chuẩn REST** — FastAPI tự sinh OpenAPI docs tại `/docs` (thân thiện tác giả).
- Tách frontend/backend → có thể phát triển app mobile sau này dùng chung API.

## 3. Hiện trạng (GĐ 0)

- `main.py` — app FastAPI, endpoint `GET /health` → `{"status":"ok",...}`.
- Chạy: `npm run api` (uvicorn, port 8000).

## 4. Thiết kế đích (GĐ 5)

### 4.1 DB (SQLite — một file `data.db`, dễ backup)

```sql
users        (id, email, password_hash, created_at)
devices      (id, user_id, device_name, last_sync_at)
entries      (id, user_id, device_id, word, data_json, updated_at, deleted)
daily        (user_id, date, entry_ids_json, updated_at)
history      (id, user_id, device_id, ts, game, word_id, correct)
sync_cursor  (device_id, last_seq)   -- đánh dấu điểm đồng bộ
```

### 4.2 Sync protocol (local-first — server là bản sao, không ghi đè mù)

```
POST /api/auth/register        {email, password} → {token}
POST /api/auth/login           {email, password} → {token}
GET  /api/sync/state           → {schemaVersion, serverCursor}
POST /api/sync/push            {clientId, entries[], daily, history, updatedAt}
       → server merge theo updated_at (muộn hơn thắng) → {serverCursor}
GET  /api/sync/pull?since=…    → {delta, serverCursor}
GET  /api/dictionary/{word}    → proxy + cache (offline dictionary fallback)
```

Nguyên tắc:
- **Merge theo `updatedAt` per-entry** — không đè toàn bộ, không mất dữ liệu.
- Client vẫn chạy offline hoàn toàn; sync chạy nền khi có mạng.
- `deleted` đánh dấu xóa (soft delete) để đồng bộ được.
- Xung đột cùng lúc sửa: bản `updatedAt` lớn hơn thắng + giữ bản cũ ở `entries.history`.

### 4.3 Auth

- JWT (hoặc token dạng `user_id:random` lưu hashed) — đủ cho nhóm bạn bè.
- Mật khẩu hash bằng `bcrypt`/`argon2` — KHÔNG lưu plaintext.
- `HTTPS` bắt buộc khi deploy thật.

### 4.4 Định dạng payload (types đã có ở packages/shared)

```ts
interface SyncPayload {
  clientId: string;                      // định danh thiết bị
  entries: WordEntry[];                  // entry có updatedAt (mở rộng từ WordEntry)
  daily: Record<string, string[]>;
  history: HistoryRecord[];
  updatedAt: string;                     // ISO
  schemaVersion: number;                 // để nâng cấp schema an toàn
}
```

## 5. Deploy

- Dev: `npm run api` → http://localhost:8000/docs (OpenAPI).
- Prod: uvicorn sau nginx/Cloudflare; SQLite file + backup hằng ngày;
  hoặc Render/Fly.io free tier.
