"""Verify Firebase Authentication ID tokens on the backend.

Firebase ID tokens are standard RS256 JWTs signed by Google. We verify them
against Google's public signing keys (JWKS) and check the audience/issuer match
this Firebase project. This is real, secure server-side verification that needs
only the public project id — no service-account private key.
"""

import re
import time

import httpx
from jose import jwt
from jose.exceptions import JWTError

from app.core.config import settings

# Google's public keys for Firebase Secure Token Service, in JWK format.
FIREBASE_JWKS_URL = (
    "https://www.googleapis.com/service_accounts/v1/jwk/"
    "securetoken@system.gserviceaccount.com"
)


class FirebaseAuthError(Exception):
    """Raised when a Firebase ID token cannot be verified."""


_jwks_cache: dict = {"keys": None, "expires_at": 0.0}


def _issuer() -> str:
    return f"https://securetoken.google.com/{settings.FIREBASE_PROJECT_ID}"


async def _get_jwks() -> list[dict]:
    now = time.time()
    if _jwks_cache["keys"] and _jwks_cache["expires_at"] > now:
        return _jwks_cache["keys"]

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(FIREBASE_JWKS_URL)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])

    max_age = 3600
    match = re.search(r"max-age=(\d+)", resp.headers.get("Cache-Control", ""))
    if match:
        max_age = int(match.group(1))

    _jwks_cache["keys"] = keys
    _jwks_cache["expires_at"] = now + max_age
    return keys


def _find_key(keys: list[dict], kid: str | None) -> dict | None:
    return next((key for key in keys if key.get("kid") == kid), None)


async def verify_firebase_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return its claims, or raise FirebaseAuthError."""
    if not settings.FIREBASE_PROJECT_ID:
        raise FirebaseAuthError("Firebase project not configured")

    try:
        header = jwt.get_unverified_header(id_token)
    except JWTError:
        raise FirebaseAuthError("Malformed token")

    kid = header.get("kid")
    keys = await _get_jwks()
    key = _find_key(keys, kid)
    if key is None:
        # Keys rotate; force a refresh once before giving up.
        _jwks_cache["expires_at"] = 0.0
        keys = await _get_jwks()
        key = _find_key(keys, kid)
    if key is None:
        raise FirebaseAuthError("Unknown signing key")

    try:
        claims = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=settings.FIREBASE_PROJECT_ID,
            issuer=_issuer(),
            options={"verify_at_hash": False},
        )
    except JWTError as exc:
        raise FirebaseAuthError(f"Invalid token: {exc}")

    if not claims.get("sub"):
        raise FirebaseAuthError("Token missing subject")
    return claims
