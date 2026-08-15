"""English Learning API — FastAPI (GĐ 5: đồng bộ đa người dùng + proxy từ điển).

Tài khoản + token Bearer + merge theo updated_at (muộn hơn thắng):
  POST /api/auth/register      {email, password} → {token, email}
  POST /api/auth/login         {email, password} → {token, email}
  POST /api/auth/logout        (Bearer) → {"ok": true}
  GET  /api/me                 (Bearer) → {email}
  GET  /api/sync/state         (Bearer) → {schemaVersion, serverCursor, counts}
  POST /api/sync/push          (Bearer) payload → {serverCursor, pushed}
  GET  /api/sync/pull?since=   (Bearer) → {entries, daily, history, serverCursor}
  GET  /api/dictionary/{word}            → proxy + cache (7 ngày)

Chạy: pip install -r apps/api/requirements.txt && npm run api
Docs:  http://localhost:8000/docs · Chi tiết thiết kế: docs/API-SYNC.md
"""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import auth, db

app = FastAPI(
    title="English Learning API",
    description="Đồng bộ dữ liệu học tập + proxy từ điển cho app English Learning.",
    version="0.5.0",
)

# CORS: cho phép mọi origin ở dev (SPA file:// hoặc localhost). Deploy thật bật HTTPS + siết lại.
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SCHEMA_VERSION = 1
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


@app.get("/")
def root() -> dict:
    return {"service": "english-learning-api", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health() -> dict:
    """Kiểm tra API sống — dùng cho CI/CD và khi deploy."""
    db.init_db()
    return {"status": "ok", "service": "english-learning-api", "version": app.version}


# ---------------- models ----------------

class AuthReq(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6, max_length=200)


class TokenResp(BaseModel):
    token: str
    email: str


class SyncEntry(BaseModel):
    courseId: str
    word: str
    dataJson: str
    updatedAt: str
    deleted: bool = False


class SyncDaily(BaseModel):
    courseId: str
    date: str
    entryIds: list[str]
    updatedAt: str


class SyncHistory(BaseModel):
    courseId: str
    ts: str
    game: str
    word: str
    correct: bool
    updatedAt: str


class SyncPushReq(BaseModel):
    clientId: str = Field(min_length=1, max_length=100)
    deviceName: str = ""
    entries: list[SyncEntry] = []
    daily: list[SyncDaily] = []
    history: list[SyncHistory] = []
    updatedAt: str = ""


# ---------------- auth dependency ----------------

def require_user(authorization: Annotated[str | None, Header()] = None) -> db.sqlite3.Row:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Thiếu token — hãy đăng nhập")
    token = authorization[len("Bearer "):].strip()
    row = db.user_by_token_hash(auth.token_hash(token))
    if not row:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn")
    return row


# ---------------- auth endpoints ----------------

@app.post("/api/auth/register", response_model=TokenResp)
def register(body: AuthReq) -> TokenResp:
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Email không hợp lệ")
    if db.user_by_email(email):
        raise HTTPException(status_code=409, detail="Email đã tồn tại — đăng nhập thôi")
    token = auth.new_token()
    db.create_user(email, auth.hash_password(body.password), auth.token_hash(token))
    return TokenResp(token=token, email=email)


@app.post("/api/auth/login", response_model=TokenResp)
def login(body: AuthReq) -> TokenResp:
    email = body.email.strip().lower()
    user = db.user_by_email(email)
    if not user or not auth.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Sai email hoặc mật khẩu")
    token = auth.new_token()
    db.set_token(user["id"], auth.token_hash(token))
    return TokenResp(token=token, email=email)


@app.post("/api/auth/logout")
def logout(user: Annotated[db.sqlite3.Row, Depends(require_user)]) -> dict:
    db.set_token(user["id"], None)
    return {"ok": True}


@app.get("/api/me")
def me(user: Annotated[db.sqlite3.Row, Depends(require_user)]) -> dict:
    return {"email": user["email"]}


# ---------------- sync endpoints ----------------

@app.get("/api/sync/state")
def sync_state(user: Annotated[db.sqlite3.Row, Depends(require_user)]) -> dict:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "serverCursor": db.max_updated_at(user["id"]) or "",
        "counts": {
            "entries": len(db.entries_since(user["id"], "")),
            "daily": len(db.daily_since(user["id"], "")),
            "history": len(db.history_since(user["id"], "")),
        },
    }


@app.post("/api/sync/push")
def sync_push(body: SyncPushReq, user: Annotated[db.sqlite3.Row, Depends(require_user)]) -> dict:
    db.upsert_device(body.clientId, user["id"], body.deviceName)
    db.upsert_entries(
        user["id"],
        [(e.courseId, e.word, e.dataJson, e.updatedAt, 1 if e.deleted else 0) for e in body.entries],
    )
    db.upsert_daily(
        user["id"],
        [(d.courseId, d.date, json.dumps(d.entryIds, ensure_ascii=False), d.updatedAt) for d in body.daily],
    )
    db.insert_history(
        user["id"],
        [(h.courseId, h.ts, h.game, h.word, 1 if h.correct else 0, h.updatedAt) for h in body.history],
    )
    return {
        "serverCursor": db.max_updated_at(user["id"]) or body.updatedAt,
        "pushed": {
            "entries": len(body.entries),
            "daily": len(body.daily),
            "history": len(body.history),
        },
    }


@app.get("/api/sync/pull")
def sync_pull(
    since: str = "",
    user: Annotated[db.sqlite3.Row, Depends(require_user)] = None,  # type: ignore[assignment]
) -> dict:
    return {
        "entries": [
            {
                "courseId": r["course_id"],
                "word": r["word"],
                "dataJson": r["data_json"],
                "updatedAt": r["updated_at"],
                "deleted": bool(r["deleted"]),
            }
            for r in db.entries_since(user["id"], since)
        ],
        "daily": [
            {
                "courseId": r["course_id"],
                "date": r["date"],
                "entryIds": json.loads(r["entry_ids_json"]),
                "updatedAt": r["updated_at"],
            }
            for r in db.daily_since(user["id"], since)
        ],
        "history": [
            {
                "id": r["id"],
                "courseId": r["course_id"],
                "ts": r["ts"],
                "game": r["game"],
                "word": r["word"],
                "correct": bool(r["correct"]),
                "updatedAt": r["updated_at"],
            }
            for r in db.history_since(user["id"], since)
        ],
        "serverCursor": db.max_updated_at(user["id"]) or "",
    }


# ---------------- dictionary proxy (offline bank vẫn là nguồn chính; proxy là bổ sung) ----------------

_DICT_API = "https://api.dictionaryapi.dev/api/v2/entries/en/"


@app.get("/api/dictionary/{word:path}")
def dictionary(word: str) -> dict[str, Any]:
    word = word.strip().lower()
    # Chỉ từ đơn tiếng Anh (chữ cái, dấu nháy, gạch nối — không có khoảng trắng kép)
    if not word or not re.match(r"^[a-z]+(?:[' -][a-z]+)*$", word):
        raise HTTPException(status_code=422, detail="Từ không hợp lệ")
    cached = db.dict_cache_get(word)
    if cached is not None:
        return json.loads(cached)
    url = _DICT_API + urllib.parse.quote(word)
    req = urllib.request.Request(url, headers={"User-Agent": "english-learning/0.5"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"word": word, "notFound": True}
        raise HTTPException(status_code=502, detail=f"Từ điển ngoài trả lỗi {e.code}")
    except urllib.error.URLError:
        raise HTTPException(status_code=502, detail="Không kết nối được từ điển ngoài")
    db.dict_cache_put(word, json.dumps(data, ensure_ascii=False))
    return {"word": word, "data": data}
