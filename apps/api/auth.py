"""Auth: hash mật khẩu (PBKDF2 — stdlib, không cần bcrypt) + token Bearer.

- Mật khẩu: PBKDF2-HMAC-SHA256, 210.000 vòng, salt 16 byte, lưu dạng
  `pbkdf2$210000$<salt hex>$<hash hex>` — không lưu plaintext.
- Token: `secrets.token_hex(24)` trả client; lưu SHA-256 của token (nếu lộ DB
  không lấy lại được token). Xác thực: Bearer <token> → hash → tra users.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets

_ITERATIONS = 210_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    return f"pbkdf2${_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt_hex, hash_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iters)
        )
        return hmac.compare_digest(digest.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


def new_token() -> str:
    """Token trả cho client (lưu hash SHA-256 trong DB)."""
    return secrets.token_hex(24)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
