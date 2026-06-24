"""Image uploads (anúncios, avatar, banner).

As imagens são validadas, normalizadas e re-codificadas em WebP com Pillow (que
remove EXIF e neutraliza payloads polyglot/SVG-XSS, pois só uma imagem raster
real sobrevive a um decode→re-encode) e **guardadas no MongoDB** (coleção
``media``), sendo servidas por ``GET /api/v1/media/{id}``.

Porquê na base de dados e não no disco: no alojamento gratuito (Render) o disco é
efémero — qualquer redeploy apagaria os ficheiros e as imagens ficariam partidas.
O MongoDB (Atlas) é persistente, por isso as imagens sobrevivem a redeploys. O URL
devolvido é absoluto e derivado do próprio pedido, ficando correto mesmo que o
``BACKEND_PUBLIC_URL`` não esteja configurado.
"""

from __future__ import annotations

import mimetypes
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Optional

mimetypes.add_type("image/webp", ".webp")

from bson import Binary, ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.api.deps import get_database, get_optional_firebase_user
from app.core.config import settings

router = APIRouter()

# Mantido apenas para compatibilidade com o mount /media (StaticFiles) e uploads
# antigos; os novos uploads vão para o MongoDB.
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_BYTES = 5 * 1024 * 1024
MIN_WIDTH, MIN_HEIGHT = 800, 600
MAX_EDGE = 1600  # longest stored edge (px)
ALLOWED_TYPES = {"image/webp", "image/png", "image/jpeg"}


def _media_collection():
    return get_database().media


def _public_base(request: Request) -> str:
    """URL absoluto do backend, robusto a BACKEND_PUBLIC_URL mal configurado.

    Usa o BACKEND_PUBLIC_URL se for um URL público válido; caso contrário deriva
    do pedido, respeitando os cabeçalhos do proxy (x-forwarded-proto/host) para
    obter https e o host real no Render.
    """
    cfg = (settings.BACKEND_PUBLIC_URL or "").rstrip("/")
    if cfg and "localhost" not in cfg and "127.0.0.1" not in cfg:
        return cfg
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.netloc
    )
    return f"{proto}://{host}"


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    _user: Optional[dict] = Depends(get_optional_firebase_user),
):
    """Valida, normaliza e guarda uma imagem (no MongoDB); devolve o URL público."""
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
    out = BytesIO()
    image.save(out, format="WEBP", quality=82, method=4)
    data = out.getvalue()

    doc = {
        "data": Binary(data),
        "content_type": "image/webp",
        "width": image.width,
        "height": image.height,
        "created_at": datetime.now(timezone.utc),
    }
    result = await _media_collection().insert_one(doc)
    media_id = str(result.inserted_id)

    return {
        "url": f"{_public_base(request)}/api/v1/media/{media_id}",
        "filename": media_id,
        "width": image.width,
        "height": image.height,
    }


@router.get("/{identifier}")
async def get_image(identifier: str):
    """Serve uma imagem guardada no MongoDB (público, com cache longa)."""
    try:
        oid = ObjectId(identifier)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagem não encontrada.")
    doc = await _media_collection().find_one({"_id": oid})
    if not doc or "data" not in doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagem não encontrada.")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc.get("content_type", "image/webp"),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.delete("/{identifier}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    identifier: str,
    _user: Optional[dict] = Depends(get_optional_firebase_user),
):
    """Remove uma imagem (best-effort; tolerante a ids antigos/inválidos)."""
    try:
        oid = ObjectId(identifier)
    except (InvalidId, TypeError):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    await _media_collection().delete_one({"_id": oid})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
