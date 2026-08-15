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

## 3. Hiện trạng (GĐ 5 — ĐÃ LÀM ✅)

- `apps/api/` — FastAPI đầy đủ: auth + sync + proxy từ điển (xem §4).
  - Chạy: `npm run api` (uvicorn, port 8000) · docs tại `/docs`.
  - Test: `python -m pytest apps/api/test_api.py -q` (13 test: auth + merge LWW + soft-delete + proxy).
- `apps/web/` — nút **⚙️ Tài khoản & đồng bộ** trên header (AccountModal):
  đăng ký/đăng nhập, đồng bộ ngay, tự push 2s sau mỗi thay đổi khi đã đăng nhập.
  Logic thuần + 6 vitest ở `src/lib/sync.ts` (buildPushBody/mergePull).

> Ghi chú: sync áp dụng cho **khóa học đang mở** (mỗi dòng có `course_id`);
> client không cần đổi máy là xong — pull về gộp theo `updated_at` rồi push tiếp.

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
- **Lưu ý đồng hồ thiết bị:** LWW dùng timestamp ISO utc — nếu máy bạn để giờ sai, dữ
  liệu local có thể bị xem là cũ. Đủ dùng cho nhóm bạn bè; khi cần chặt chẽ mới đổi
  sang sequence server (serverCursor).
- **DB nằm ở `data/api.db`** (git-ignored, backup riêng; đổi bằng env `API_DB`).

### 4.3 Auth

- **JS:** pbkdf2_hmac (sha256, 210k vòng — stdlib, không cần bcrypt).
- **Token:** `secrets.token_hex(24)` trả client; lưu **SHA-256** của token (DB lộ không lấy lại được token). Header `Authorization: Bearer <token>`.
- **Cảnh báo:** invalidaToken khi logout — nếu DB bị đọc lén, token hash vô dụng.
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
