from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_access_token
from app.db.mongo import get_db_client
from app.services.firebase_auth import FirebaseAuthError, verify_firebase_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_database():
    return get_db_client().solar_p2p


def require_object_id(value: str, field_name: str = "id") -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field_name}",
        )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = require_object_id(str(payload["sub"]), "user_id")
    db = get_database()
    user = await db.users.find_one({"_id": user_id, "is_active": {"$ne": False}})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_optional_firebase_user(
    authorization: Optional[str] = Header(default=None),
) -> Optional[dict]:
    """Return the verified Firebase claims if a valid Bearer token is present, else None."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        return await verify_firebase_token(token)
    except FirebaseAuthError:
        return None
    except Exception:
        # Network/JWKS issues shouldn't break guest checkout — treat as anonymous.
        return None


async def get_firebase_user(
    user: Optional[dict] = Depends(get_optional_firebase_user),
) -> dict:
    """Require a valid Firebase ID token."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
