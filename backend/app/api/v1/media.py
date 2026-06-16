"""Listing image uploads (Etapa 3).

Dev-grade local storage: uploads are validated, normalized and re-encoded to
WebP with Pillow (which strips EXIF and defeats polyglot/SVG-XSS payloads, since
only a real raster image survives a decode→re-encode round-trip), then written
to ``backend/uploads`` and served by StaticFiles at ``/media``. In production
this should move to object storage (Firebase Storage / S3) behind a CDN, with
the upload endpoint requiring auth and rate-limiting.
"""

from __future__ import annotations

import mimetypes
import uuid
from io import BytesIO
from pathlib import Path
from typing import Optional

# Some platforms (e.g. Windows) don't register .webp, so StaticFiles would serve
# it as text/plain. Register it so images get the correct Content-Type.
mimetypes.add_type("image/webp", ".webp")

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.api.deps import get_optional_firebase_user
from app.core.config import settings

router = APIRouter()

# backend/app/api/v1/media.py -> parents[3] == backend/
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_BYTES = 5 * 1024 * 1024
MIN_WIDTH, MIN_HEIGHT = 800, 600
MAX_EDGE = 1600  # longest stored edge (px)
ALLOWED_TYPES = {"image/webp", "image/png", "image/jpeg"}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    _user: Optional[dict] = Depends(get_optional_firebase_user),
):
    """Validate, normalize and store one listing image; returns its public URL."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formato não suportado. Use WebP, PNG ou JPEG.",
        )

    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Imagem acima do limite de 5MB.",
        )

    try:
        Image.open(BytesIO(contents)).verify()  # structural validation
        image = Image.open(BytesIO(contents))  # re-open: verify() leaves it unusable
    except (UnidentifiedImageError, OSError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Ficheiro de imagem inválido.",
        )

    width, height = image.size
    if width < MIN_WIDTH or height < MIN_HEIGHT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Resolução mínima {MIN_WIDTH}×{MIN_HEIGHT}px (recebido {width}×{height}px).",
        )

    image = image.convert("RGB")
    image.thumbnail((MAX_EDGE, MAX_EDGE))  # downscale keeping aspect ratio
    filename = f"{uuid.uuid4().hex}.webp"
    image.save(UPLOAD_DIR / filename, format="WEBP", quality=82, method=4)

    base = settings.BACKEND_PUBLIC_URL.rstrip("/")
    return {
        "url": f"{base}/media/{filename}",
        "filename": filename,
        "width": image.width,
        "height": image.height,
    }


@router.delete("/{filename}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    filename: str,
    _user: Optional[dict] = Depends(get_optional_firebase_user),
):
    """Remove a previously-uploaded image (best-effort; path-traversal safe)."""
    safe = Path(filename).name
    if safe != filename or not safe.endswith(".webp"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome inválido.")
    target = UPLOAD_DIR / safe
    if target.exists():
        target.unlink()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
