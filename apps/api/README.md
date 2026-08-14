# apps/api — FastAPI backend

**Mục đích**: đồng bộ dữ liệu học tập giữa nhiều thiết bị / người dùng (GĐ 5), proxy từ điển.

**Lợi ích**:
- Người dùng tạo tài khoản → dữ liệu học (từ vựng, streak, lịch sử) lưu trên server → dùng được ở nhiều máy.
- Proxy dictionary API → tránh CORS + rate-limit, có cache.
- Viết bằng **FastAPI (Python)** — thân thiện với tác giả.

**Cấu trúc hiện tại**:
- `main.py` — app FastAPI, endpoint `/health`.
- `requirements.txt` — fastapi + uvicorn.

**Chạy**:
```bash
pip install -r apps/api/requirements.txt
npm run api        # uvicorn apps.api.main:app --reload --port 8000
# mở http://localhost:8000/health → {"status":"ok",...}
```

Thiết kế chi tiết (sync protocol, auth, schema DB): xem `docs/API-SYNC.md`.
