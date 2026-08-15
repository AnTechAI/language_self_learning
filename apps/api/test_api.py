"""Test API FastAPI — auth, sync merge theo updated_at, dictionary proxy (404 fallback).

Chạy: python -m pytest apps/api/test_api.py -q   (từ thư mục gốc repo)
Yêu cầu: pip install pytest httpx (đã có trong requirements.txt)
"""
from __future__ import annotations

import os
import sys
import tempfile

import pytest

# Đặt DB test trước khi import app (db.py đọc env API_DB lúc import).
_tmp = tempfile.mkdtemp(prefix="elapi-")
os.environ["API_DB"] = os.path.join(_tmp, "test.db")

# apps/ lên sys.path để import package `api`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

from api import db  # noqa: E402
from api.main import app  # noqa: E402

# TestClient không dùng context manager → startup event không chạy; init DB tường minh.
db.init_db()

client = TestClient(app)


@pytest.fixture(autouse=True)
def _fresh_db():
    """Cô lập từng test: xóa toàn bộ dữ liệu (DB dùng chung giữa các test)."""
    db.init_db()
    conn = db.connect()
    try:
        for t in ("devices", "entries", "daily", "history", "dict_cache", "users"):
            conn.execute(f"DELETE FROM {t}")
        conn.commit()
    finally:
        conn.close()
    yield


def _auth(email: str = "a@b.com", password: str = "secret123") -> dict:
    r = client.post("/api/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def _push(token: str, **over) -> dict:
    payload = {
        "clientId": "dev-1",
        "deviceName": "test",
        "entries": [],
        "daily": [],
        "history": [],
        "updatedAt": "2026-01-01T00:00:00.000000+00:00",
    }
    payload.update(over)
    r = client.post("/api/sync/push", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- health / root ----------------

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------------- auth ----------------

def test_register_login_logout():
    auth = _auth("hi@x.com")
    assert auth["email"] == "hi@x.com" and auth["token"]
    # đăng ký trùng → 409
    assert client.post(
        "/api/auth/register", json={"email": "hi@x.com", "password": "secret123"}
    ).status_code == 409
    # đăng nhập sai pass → 401
    assert client.post(
        "/api/auth/login", json={"email": "hi@x.com", "password": "wrongpass"}
    ).status_code == 401
    # đăng nhập đúng → token mới
    login = client.post("/api/auth/login", json={"email": "hi@x.com", "password": "secret123"})
    assert login.status_code == 200
    token2 = login.json()["token"]
    # /api/me dùng token
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token2}"}).json()["email"] == "hi@x.com"
    # token cũ vô hiệu sau logout
    client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token2}"})
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token2}"}).status_code == 401
    # không token → 401
    assert client.get("/api/me").status_code == 401


def test_register_invalid_email():
    assert client.post(
        "/api/auth/register", json={"email": "not-an-email", "password": "secret123"}
    ).status_code == 422


# ---------------- sync: merge theo updated_at (muộn hơn thắng) ----------------

def test_push_pull_roundtrip():
    tok = _auth()["token"]
    e1 = {
        "courseId": "en",
        "word": "gratitude",
        "dataJson": '{"senses":[]}',
        "updatedAt": "2026-01-01T10:00:00.000000+00:00",
    }
    r = _push(tok, entries=[e1])
    assert r["pushed"]["entries"] == 1

    # pull since trước → có entry
    pull = client.get(
        "/api/sync/pull", params={"since": "2026-01-01T00:00:00.000000+00:00"},
        headers={"Authorization": f"Bearer {tok}"},
    ).json()
    assert len(pull["entries"]) == 1
    assert pull["entries"][0]["word"] == "gratitude"

    # pull since SAU bản ghi → rỗng (cursor hoạt động)
    pull2 = client.get(
        "/api/sync/pull", params={"since": r["serverCursor"]},
        headers={"Authorization": f"Bearer {tok}"},
    ).json()
    assert pull2["entries"] == []


def test_merge_newer_wins():
    tok = _auth()["token"]
    old = {
        "courseId": "en", "word": "case",
        "dataJson": '{"v":1}',
        "updatedAt": "2026-01-01T10:00:00.000000+00:00",
    }
    newer = {
        "courseId": "en", "word": "case",
        "dataJson": '{"v":2}',
        "updatedAt": "2026-01-02T10:00:00.000000+00:00",
    }
    _push(tok, entries=[old])
    _push(tok, entries=[newer])
    pull = client.get("/api/sync/pull", params={"since": ""}, headers={"Authorization": f"Bearer {tok}"}).json()
    assert pull["entries"][0]["dataJson"] == '{"v":2}'


def test_merge_older_ignored():
    tok = _auth()["token"]
    newer = {
        "courseId": "en", "word": "case",
        "dataJson": '{"v":2}',
        "updatedAt": "2026-01-02T10:00:00.000000+00:00",
    }
    older = {
        "courseId": "en", "word": "case",
        "dataJson": '{"v":1}',
        "updatedAt": "2026-01-01T10:00:00.000000+00:00",
    }
    _push(tok, entries=[newer])
    _push(tok, entries=[older])
    pull = client.get("/api/sync/pull", params={"since": ""}, headers={"Authorization": f"Bearer {tok}"}).json()
    assert pull["entries"][0]["dataJson"] == '{"v":2}'


def test_daily_and_history_sync():
    tok = _auth()["token"]
    _push(
        tok,
        daily=[{"courseId": "en", "date": "2026-01-01", "entryIds": ["a", "b"], "updatedAt": "2026-01-01T10:00:00.000000+00:00"}],
        history=[{"courseId": "en", "ts": "2026-01-01T10:00:00.000000+00:00", "game": "choice", "word": "case", "correct": True, "updatedAt": "2026-01-01T10:00:00.000000+00:00"}],
    )
    pull = client.get("/api/sync/pull", params={"since": ""}, headers={"Authorization": f"Bearer {tok}"}).json()
    assert pull["daily"][0]["entryIds"] == ["a", "b"]
    assert len(pull["history"]) == 1


def test_history_dedupe_on_repush():
    tok = _auth()["token"]
    h = {"courseId": "en", "ts": "2026-01-01T10:00:00.000000+00:00", "game": "choice", "word": "case", "correct": True, "updatedAt": "2026-01-01T10:00:00.000000+00:00"}
    _push(tok, history=[h])
    _push(tok, history=[h])  # push lặp payload cũ
    pull = client.get("/api/sync/pull", params={"since": ""}, headers={"Authorization": f"Bearer {tok}"}).json()
    assert len(pull["history"]) == 1


def test_soft_delete_entry():
    tok = _auth()["token"]
    e = {"courseId": "en", "word": "gone", "dataJson": "{}", "updatedAt": "2026-01-01T10:00:00.000000+00:00"}
    _push(tok, entries=[e])
    e2 = {**e, "deleted": True, "updatedAt": "2026-01-02T10:00:00.000000+00:00"}
    _push(tok, entries=[e2])
    pull = client.get("/api/sync/pull", params={"since": ""}, headers={"Authorization": f"Bearer {tok}"}).json()
    assert pull["entries"][0]["deleted"] is True


def test_sync_isolated_between_users():
    t1 = _auth("u1@x.com")["token"]
    t2 = _auth("u2@x.com")["token"]
    _push(t1, entries=[{"courseId": "en", "word": "mine", "dataJson": "{}", "updatedAt": "2026-01-01T10:00:00.000000+00:00"}])
    pull2 = client.get("/api/sync/pull", params={"since": ""}, headers={"Authorization": f"Bearer {t2}"}).json()
    assert pull2["entries"] == []


# ---------------- dictionary proxy ----------------

def test_dictionary_404_word():
    # Từ chắc chắn không tồn tại → notFound (không 500).
    # Không mạng → 502 cũng chấp nhận (proxy phụ, offline bank là nguồn chính).
    r = client.get("/api/dictionary/zzzzqqqqnotaword")
    if r.status_code == 502:
        pytest.skip("không có mạng — proxy từ điển không test được")
    assert r.status_code == 200
    assert r.json().get("notFound") is True


def test_dictionary_invalid_word():
    assert client.get("/api/dictionary/abc%21").status_code == 422  # '!' không hợp lệ
    assert client.get("/api/dictionary/123").status_code == 422  # số không hợp lệ


def test_dictionary_real_word_or_cache():
    # Có mạng: lấy thật; không mạng: 502 là chấp nhận được (proxy phụ).
    r = client.get("/api/dictionary/gratitude")
    if r.status_code == 200:
        body = r.json()
        assert body["word"] == "gratitude"
        assert "data" in body or body.get("notFound")
