"""Verify Firebase Authentication ID tokens on the backend.

Firebase ID tokens are RS256 JWTs signed by Google. The classic approach is to
download Google's public JWKS and verify the signature locally. That JWKS file
lives on www.googleapis.com behind an *anonymous, per-source-IP* rate limit and
ignores any API key — on shared datacenter egress IPs (e.g. Render's free tier)
Google returns 403 Forbidden for it, which broke token verification here.

So instead we verify the token through Google's Identity Toolkit REST API
(`accounts:lookup`) on identitytoolkit.googleapis.com, authenticated with the
project's public web API key. It is a different host, quota'd per project rather
than per IP, and is the exact endpoint the Firebase client SDKs hit constantly —
so it is not subject to the JWKS file's per-IP block. Google validates the
token's signature, audience and expiry server-side; an invalid/expired token
yields a non-200 response, which we surface as FirebaseAuthError.
"""

import time

import httpx
from jose import jwt
from jose.exceptions import JWTError

from app.core.config import settings

# Identity Toolkit endpoint that returns the account for a valid ID token.
IDENTITY_TOOLKIT_LOOKUP_URL = (
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup"
)


class FirebaseAuthError(Exception):
    """Raised when a Firebase ID token cannot be verified."""


# Small in-memory cache of verified tokens so we don't call Google on every
# request (the WebSocket reconnect loop and polling endpoints reuse the same
# token for up to an hour). Keyed by the raw token -> (expires_at, claims).
_token_cache: dict[str, tuple[float, dict]] = {}
_CACHE_MAX_TTL = 300  # never trust a cached verification for more than 5 min
_CACHE_MAX_ENTRIES = 2048


def _cache_get(token: str) -> dict | None:
    entry = _token_cache.get(token)
    if entry is None:
        return None
    expires_at, claims = entry
    if expires_at <= time.time():
        _token_cache.pop(token, None)
        return None
    return claims


def _cache_put(token: str, claims: dict) -> None:
    # Bound the cache lifetime to the token's own expiry (read unverified — only
    # to size the cache window; Google already verified the token for real).
    ttl = _CACHE_MAX_TTL
    try:
        exp = int(jwt.get_unverified_claims(token).get("exp", 0))
        if exp:
            ttl = min(_CACHE_MAX_TTL, max(0, exp - time.time()))
    except JWTError:
        ttl = _CACHE_MAX_TTL
    if ttl <= 0:
        return
    if len(_token_cache) >= _CACHE_MAX_ENTRIES:
        _token_cache.clear()
    _token_cache[token] = (time.time() + ttl, claims)


async def verify_firebase_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return its claims, or raise FirebaseAuthError."""
    if not id_token:
        raise FirebaseAuthError("Missing token")
    if not settings.FIREBASE_WEB_API_KEY:
        raise FirebaseAuthError("Firebase web API key not configured")

    cached = _cache_get(id_token)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                IDENTITY_TOOLKIT_LOOKUP_URL,
                params={"key": settings.FIREBASE_WEB_API_KEY},
                json={"idToken": id_token},
            )
    except httpx.HTTPError as exc:
        raise FirebaseAuthError(f"Token verification request failed: {exc}")

    if resp.status_code != 200:
        # Google rejects expired / malformed / wrong-project tokens here.
        raise FirebaseAuthError(f"Invalid token (status {resp.status_code})")

    users = resp.json().get("users") or []
    if not users:
        raise FirebaseAuthError("Token not associated with any account")

    record = users[0]
    uid = record.get("localId")
    if not uid:
        raise FirebaseAuthError("Token missing subject")

    claims = {
        "sub": uid,
        "uid": uid,
        "user_id": uid,
        "email": record.get("email"),
        "email_verified": record.get("emailVerified", False),
        "name": record.get("displayName"),
        "picture": record.get("photoUrl"),
    }

    _cache_put(id_token, claims)
    return claims
