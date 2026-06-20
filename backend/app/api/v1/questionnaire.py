"""Questionnaire API — the user's primary onboarding flow.

All routes require a verified Firebase user (``get_firebase_user``) and key data by
the Firebase uid. The agent prose is never returned here: ``/simulate`` and
``/result`` only expose the frontend-safe numbers.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.agents.reasoning import generate_reasoning
from app.api.deps import get_firebase_user
from app.schemas.questionnaire import (
    BillExtraction,
    Questionnaire,
    QuestionnaireResult,
)
from app.services.bill_extract import extract_bill
from app.services.catalog import get_panel_specs_from_products
from app.services.panel_sourcing import source_ideal_panels
from app.services.pvgis import fetch_pvgis_irradiation
from app.services.questionnaire_store import (
    get_latest_result,
    get_questionnaire,
    has_completed,
    save_questionnaire,
    save_result,
)
from app.services.simulation_core import run_questionnaire_simulation

logger = logging.getLogger(__name__)
router = APIRouter()

BILL_DIR = Path(__file__).resolve().parents[3] / "uploads" / "bills"
MAX_BILL_BYTES = 10 * 1024 * 1024  # 10 MB


@router.get("/status")
async def questionnaire_status(user: dict = Depends(get_firebase_user)) -> dict:
    return {"completed": await has_completed(user["sub"])}


@router.get("/")
async def get_my_questionnaire(user: dict = Depends(get_firebase_user)):
    questionnaire = await get_questionnaire(user["sub"])
    return questionnaire.model_dump() if questionnaire else None


@router.put("/")
async def put_my_questionnaire(
    payload: Questionnaire, user: dict = Depends(get_firebase_user)
) -> dict:
    await save_questionnaire(user["sub"], payload)
    return {"saved": True}


@router.post("/bill", response_model=BillExtraction)
async def upload_bill(
    file: UploadFile = File(...), user: dict = Depends(get_firebase_user)
) -> BillExtraction:
    content = await file.read()
    if len(content) > MAX_BILL_BYTES:
        raise HTTPException(status_code=413, detail="Ficheiro demasiado grande (máx. 10 MB).")
    if not content:
        raise HTTPException(status_code=400, detail="Ficheiro vazio.")

    # Guarda a fatura como referência (não bloqueia se falhar).
    try:
        user_dir = BILL_DIR / user["sub"]
        user_dir.mkdir(parents=True, exist_ok=True)
        safe_name = Path(file.filename or "fatura").name
        (user_dir / safe_name).write_bytes(content)
    except Exception as exc:
        logger.warning("Could not persist bill file: %s", exc)

    return await extract_bill(content, file.content_type)


@router.post("/simulate", response_model=QuestionnaireResult)
async def simulate(
    payload: Questionnaire, user: dict = Depends(get_firebase_user)
) -> QuestionnaireResult:
    uid = user["sub"]
    catalog = await get_panel_specs_from_products()
    if not catalog:
        raise HTTPException(status_code=503, detail="Catálogo de painéis indisponível.")

    # Produção específica precisa da localização (PVGIS), mostrada ao lado da regional.
    pvgis_yield = None
    if payload.latitude is not None and payload.longitude is not None:
        pvgis = await fetch_pvgis_irradiation(
            payload.latitude, payload.longitude, angle=payload.tilt_degrees, aspect=payload.aspect_degrees
        )
        pvgis_yield = pvgis.E_y if pvgis else None

    try:
        result, analysis = run_questionnaire_simulation(payload, catalog, pvgis_yield)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    recommended = next(
        s for s in result.solutions if s.archetype == result.recommended_archetype
    )

    # Prosa (escondida) e sourcing correm em paralelo.
    reasoning, ideal_panels = await asyncio.gather(
        generate_reasoning(
            analysis,
            {
                "region": payload.region,
                "annual_consumption_kwh": payload.annual_consumption_kwh,
                "coverage": payload.coverage,
            },
        ),
        source_ideal_panels(
            target_power_w=recommended.panel.power_w,
            target_power_kwp=recommended.installed_power_kwp,
            latitude=payload.latitude,
            longitude=payload.longitude,
            budget_per_panel=recommended.panel.avg_price_eur,
        ),
    )

    await save_questionnaire(uid, payload)
    created_iso = await save_result(
        uid,
        questionnaire=payload,
        result=result,
        analysis=analysis,
        reasoning=reasoning,
        ideal_panels=ideal_panels,
    )
    return result.model_copy(update={"ideal_panels": ideal_panels, "created_at": created_iso})


@router.get("/result", response_model=QuestionnaireResult)
async def latest_result(user: dict = Depends(get_firebase_user)) -> QuestionnaireResult:
    result = await get_latest_result(user["sub"])
    if not result:
        raise HTTPException(status_code=404, detail="Ainda não há simulação.")
    return QuestionnaireResult(**result)


async def _fetch_recommended_panel_image(record: dict) -> bytes | None:
    """Descarrega a foto do painel recomendado para embeber no PDF (best-effort)."""
    result = record.get("result", {})
    solutions = result.get("solutions", [])
    rec_key = result.get("recommended_archetype")
    rec = next((s for s in solutions if s.get("archetype") == rec_key), solutions[0] if solutions else {})
    image_url = (rec.get("panel") or {}).get("image_url")
    if not image_url:
        return None
    try:
        import httpx

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(image_url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            if resp.headers.get("content-type", "").startswith("image/"):
                return resp.content
    except Exception as exc:
        logger.warning("Could not fetch panel image for PDF: %s", exc)
    return None


@router.get("/orcamento.pdf")
async def download_quote(user: dict = Depends(get_firebase_user)) -> Response:
    from app.services.questionnaire_store import get_full_record
    from app.services.quote_pdf import build_quote_pdf

    record = await get_full_record(user["sub"])
    if not record:
        raise HTTPException(status_code=404, detail="Ainda não há simulação.")
    record["panel_image_bytes"] = await _fetch_recommended_panel_image(record)
    try:
        pdf_bytes = build_quote_pdf(record)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="orcamento-reisolari.pdf"'},
    )
