from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo.errors import DuplicateKeyError

from app.api.deps import get_current_user, get_database
from app.core.security import create_access_token, hash_password, verify_password
from app.schemas.user import Token, UserCreate, UserLogin, UserPublic, UserUpdate, serialize_user

router = APIRouter()


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register_user(payload: UserCreate):
    db = get_database()
    now = datetime.now(timezone.utc)
    email = payload.email.lower()
    user_doc = {
        "email": email,
        "hashed_password": hash_password(payload.password),
        "full_name": payload.full_name,
        "is_seller": payload.is_seller,
        "gdpr_consent": payload.gdpr_consent,
        "stripe_account_id": None,
        "stripe_onboarding_complete": False,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = await db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user_doc["_id"] = result.inserted_id
    return serialize_user(user_doc)


@router.post("/login", response_model=Token)
async def login_user(payload: UserLogin):
    db = get_database()
    user = await db.users.find_one({"email": payload.email.lower(), "is_active": {"$ne": False}})
    if user is None or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(str(user["_id"]))
    return Token(access_token=token, user=serialize_user(user))


@router.get("/me", response_model=UserPublic)
async def read_me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)


@router.patch("/me", response_model=UserPublic)
async def update_me(payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return serialize_user(current_user)

    update_data["updated_at"] = datetime.now(timezone.utc)
    db = get_database()
    await db.users.update_one({"_id": current_user["_id"]}, {"$set": update_data})
    updated = await db.users.find_one({"_id": current_user["_id"]})
    return serialize_user(updated)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(current_user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = current_user["_id"]

    await db.users.update_one(
        {"_id": user_id},
        {
            "$set": {
                "email": f"deleted-{user_id}@deleted.local",
                "hashed_password": "",
                "full_name": None,
                "gdpr_consent": False,
                "is_active": False,
                "updated_at": datetime.now(timezone.utc),
            },
            "$unset": {"stripe_account_id": "", "stripe_onboarding_complete": ""},
        },
    )
    await db.listings.update_many({"owner_id": user_id}, {"$set": {"active": False}})
    await db.chat_messages.delete_many({"sender_id": user_id})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
