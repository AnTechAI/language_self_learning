"""SQLite cho English Learning API — một file data.db, dễ backup.

Bảng (xem docs/API-SYNC.md §4.1 — thêm cột course_id để sync nhiều khóa học):
  users        (id, email, password_hash, token_hash, created_at)
  devices      (id, user_id, device_name, last_sync_at)
  entries      (user_id, course_id, word, data_json, updated_at, deleted)
  daily        (user_id, course_id, date, entry_ids_json, updated_at)
  history      (id, user_id, course_id, ts, game, word, correct, updated_at)
  dict_cache   (word, data_json, fetched_at)  — cache proxy từ điển (TTL 7 ngày)
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone

# Mặc định: data/api.db (repo root / data — git-ignored). Đổi bằng env API_DB.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.environ.get("API_DB", os.path.join(ROOT, "data", "api.db"))

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  token_hash    TEXT,
  created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  device_name   TEXT NOT NULL DEFAULT '',
  last_sync_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entries (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  course_id  TEXT NOT NULL,
  word       TEXT NOT NULL,
  data_json  TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, course_id, word)
);
CREATE TABLE IF NOT EXISTS daily (
  user_id        INTEGER NOT NULL REFERENCES users(id),
  course_id      TEXT NOT NULL,
  date           TEXT NOT NULL,
  entry_ids_json TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id, date)
);
CREATE TABLE IF NOT EXISTS history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  course_id  TEXT NOT NULL,
  ts         TEXT NOT NULL,
  game       TEXT NOT NULL,
  word       TEXT NOT NULL,
  correct    INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dict_cache (
  word       TEXT PRIMARY KEY,
  data_json  TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_daily_user  ON daily(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, updated_at);
-- Dedupe lịch sử game khi push lặp (client gửi lại payload cũ)
CREATE UNIQUE INDEX IF NOT EXISTS idx_history_dedupe
  ON history(user_id, course_id, ts, game, word, correct);
"""

# sqlite3 mặc định KHÔNG thread-safe — mở 1 connection mỗi request (qua context),
# dùng check_same_thread=False + lock cho các lệnh ghi ngắn gọn.
_lock = threading.Lock()


def now_iso() -> str:
    """ISO 8601 với micro giây — dùng làm cursor đồng bộ (so sánh chuỗi được)."""
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Tạo schema (idempotent) — gọi lúc khởi động app."""
    with _lock:
        conn = connect()
        try:
            conn.executescript(_SCHEMA)
            conn.commit()
        finally:
            conn.close()


def _one(sql: str, params: tuple = ()) -> sqlite3.Row | None:
    conn = connect()
    try:
        return conn.execute(sql, params).fetchone()
    finally:
        conn.close()


def _all(sql: str, params: tuple = ()) -> list[sqlite3.Row]:
    conn = connect()
    try:
        return conn.execute(sql, params).fetchall()
    finally:
        conn.close()


def _run(sql: str, params: tuple = ()) -> None:
    with _lock:
        conn = connect()
        try:
            conn.execute(sql, params)
            conn.commit()
        finally:
            conn.close()


def _run_many(sql: str, rows: list[tuple]) -> None:
    with _lock:
        conn = connect()
        try:
            conn.executemany(sql, rows)
            conn.commit()
        finally:
            conn.close()


# ---------------- users / auth ----------------

def create_user(email: str, password_hash: str, token_hash: str) -> int:
    created = now_iso()
    conn = connect()
    try:
        cur = conn.execute(
            "INSERT INTO users (email, password_hash, token_hash, created_at) VALUES (?,?,?,?)",
            (email, password_hash, token_hash, created),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def user_by_email(email: str) -> sqlite3.Row | None:
    return _one("SELECT * FROM users WHERE email = ?", (email,))


def user_by_token_hash(token_hash: str) -> sqlite3.Row | None:
    return _one("SELECT * FROM users WHERE token_hash = ?", (token_hash,))


def set_token(user_id: int, token_hash: str | None) -> None:
    _run("UPDATE users SET token_hash = ? WHERE id = ?", (token_hash, user_id))


# ---------------- devices ----------------

def upsert_device(device_id: str, user_id: int, device_name: str) -> None:
    _run(
        "INSERT INTO devices (id, user_id, device_name, last_sync_at) VALUES (?,?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET device_name = excluded.device_name, last_sync_at = excluded.last_sync_at",
        (device_id, user_id, device_name, now_iso()),
    )


# ---------------- entries (merge theo updated_at — muộn hơn thắng) ----------------

def upsert_entries(user_id: int, rows: list[tuple]) -> None:
    """rows: (course_id, word, data_json, updated_at, deleted)."""
    if not rows:
        return
    _run_many(
        "INSERT INTO entries (user_id, course_id, word, data_json, updated_at, deleted) "
        "VALUES (?,?,?,?,?,?) "
        "ON CONFLICT(user_id, course_id, word) DO UPDATE SET "
        "  data_json = CASE WHEN excluded.updated_at >= entries.updated_at THEN excluded.data_json ELSE entries.data_json END, "
        "  deleted   = CASE WHEN excluded.updated_at >= entries.updated_at THEN excluded.deleted ELSE entries.deleted END, "
        "  updated_at = MAX(entries.updated_at, excluded.updated_at)",
        [(user_id, *r) for r in rows],
    )


def entries_since(user_id: int, since: str) -> list[sqlite3.Row]:
    return _all(
        "SELECT course_id, word, data_json, updated_at, deleted FROM entries "
        "WHERE user_id = ? AND updated_at > ? ORDER BY updated_at",
        (user_id, since),
    )


def max_updated_at(user_id: int) -> str | None:
    row = _one("SELECT MAX(updated_at) AS m FROM entries WHERE user_id = ?", (user_id,))
    return row["m"] if row and row["m"] else None


# ---------------- daily ----------------

def upsert_daily(user_id: int, rows: list[tuple]) -> None:
    """rows: (course_id, date, entry_ids_json, updated_at)."""
    if not rows:
        return
    _run_many(
        "INSERT INTO daily (user_id, course_id, date, entry_ids_json, updated_at) "
        "VALUES (?,?,?,?,?) "
        "ON CONFLICT(user_id, course_id, date) DO UPDATE SET "
        "  entry_ids_json = CASE WHEN excluded.updated_at >= daily.updated_at THEN excluded.entry_ids_json ELSE daily.entry_ids_json END, "
        "  updated_at = MAX(daily.updated_at, excluded.updated_at)",
        [(user_id, *r) for r in rows],
    )


def daily_since(user_id: int, since: str) -> list[sqlite3.Row]:
    return _all(
        "SELECT course_id, date, entry_ids_json, updated_at FROM daily "
        "WHERE user_id = ? AND updated_at > ? ORDER BY updated_at",
        (user_id, since),
    )


# ---------------- history ----------------

def insert_history(user_id: int, rows: list[tuple]) -> None:
    """rows: (course_id, ts, game, word, correct, updated_at)."""
    if not rows:
        return
    _run_many(
        "INSERT OR IGNORE INTO history (user_id, course_id, ts, game, word, correct, updated_at) "
        "VALUES (?,?,?,?,?,?,?)",
        [(user_id, *r) for r in rows],
    )


def history_since(user_id: int, since: str) -> list[sqlite3.Row]:
    return _all(
        "SELECT id, course_id, ts, game, word, correct, updated_at FROM history "
        "WHERE user_id = ? AND updated_at > ? ORDER BY updated_at",
        (user_id, since),
    )


# ---------------- dict cache (proxy từ điển) ----------------

def dict_cache_get(word: str, ttl_days: int = 7) -> str | None:
    row = _one("SELECT data_json, fetched_at FROM dict_cache WHERE word = ?", (word,))
    if not row:
        return None
    fetched = datetime.fromisoformat(row["fetched_at"])
    if datetime.now(timezone.utc) - fetched > timedelta(days=ttl_days):
        return None
    return row["data_json"]


def dict_cache_put(word: str, data_json: str) -> None:
    _run(
        "INSERT INTO dict_cache (word, data_json, fetched_at) VALUES (?,?,?) "
        "ON CONFLICT(word) DO UPDATE SET data_json = excluded.data_json, fetched_at = excluded.fetched_at",
        (word, data_json, now_iso()),
    )


def dump_db(path: str) -> None:
    """Tiện ích test: in toàn bộ DB ra JSON (hoặc dump file)."""
    conn = connect()
    try:
        data: dict = {}
        for table in ("users", "devices", "entries", "daily", "history", "dict_cache"):
            data[table] = [dict(r) for r in conn.execute(f"SELECT * FROM {table}").fetchall()]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
    finally:
        conn.close()
