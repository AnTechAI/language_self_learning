"""English Learning API — FastAPI.

Giai đoạn 5 (đồng bộ đa người dùng — app cho bạn bè dùng chung).
Hiện tại: skeleton (health check) — chi tiết thiết kế ở docs/API-SYNC.md.

Chạy (từ thư mục gốc repo):
    pip install -r apps/api/requirements.txt
    npm run api        # uvicorn apps.api.main:app --reload --port 8000
"""

from fastapi import FastAPI

app = FastAPI(
    title="English Learning API",
    description="Đồng bộ dữ liệu học tập + proxy từ điển cho app English Learning.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict:
    """Kiểm tra API sống — dùng cho CI/CD và khi deploy."""
    return {"status": "ok", "service": "english-learning-api", "version": "0.1.0"}
