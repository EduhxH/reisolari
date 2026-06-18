"""Extract consumption data from an electricity bill via AI.

Images (JPG/PNG) are read with a Groq vision model. Digital PDF bills (which
usually carry a real text layer) are parsed by extracting their text and asking
the text model. Extraction is best-effort: the user always reviews and can
override every field, so a failure never blocks the questionnaire.
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Optional

from app.agents.groq_client import GROQ_MODEL, GROQ_VISION_MODEL, groq_client
from app.schemas.questionnaire import BillExtraction

logger = logging.getLogger(__name__)

_PROMPT = (
    "És um assistente que lê faturas de eletricidade portuguesas (EDP, Galp, Endesa, "
    "Iberdrola, etc.). Extrai apenas o que conseguires LER, sem inventar. Responde "
    "estritamente em JSON com as chaves: annual_consumption_kwh (número ou null), "
    "monthly_consumption_kwh (número ou null), contracted_power_kva (número ou null), "
    "price_eur_kwh (número ou null), supplier (texto ou null), has_social_tariff "
    "(true/false/null), confidence (0 a 1). Usa null quando não tiveres a certeza."
)


def _parse(content: str) -> BillExtraction:
    try:
        data = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return BillExtraction(confidence=0.0, raw_note="resposta não-JSON")
    allowed = set(BillExtraction.model_fields)
    clean = {k: v for k, v in data.items() if k in allowed}
    return BillExtraction(**clean)


async def extract_from_image(image_bytes: bytes, mime: str) -> BillExtraction:
    b64 = base64.b64encode(image_bytes).decode("ascii")
    try:
        resp = await groq_client.chat.completions.create(
            model=GROQ_VISION_MODEL,
            temperature=0.0,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                    ],
                }
            ],
        )
        return _parse(resp.choices[0].message.content or "")
    except Exception as exc:
        logger.warning("Bill image extraction failed: %s", exc)
        return BillExtraction(confidence=0.0, raw_note="extração de imagem indisponível")


async def _extract_from_text(text: str) -> BillExtraction:
    try:
        resp = await groq_client.chat.completions.create(
            model=GROQ_MODEL,
            temperature=0.0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _PROMPT},
                {"role": "user", "content": text[:12000]},
            ],
        )
        return _parse(resp.choices[0].message.content or "")
    except Exception as exc:
        logger.warning("Bill text extraction failed: %s", exc)
        return BillExtraction(confidence=0.0, raw_note="extração de texto indisponível")


async def extract_from_pdf(pdf_bytes: bytes) -> BillExtraction:
    try:
        from pypdf import PdfReader  # import tardio: dep opcional
        from io import BytesIO

        reader = PdfReader(BytesIO(pdf_bytes))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception as exc:
        logger.warning("PDF text layer unavailable: %s", exc)
        return BillExtraction(confidence=0.0, raw_note="PDF sem texto legível — introduza manualmente")

    if not text.strip():
        return BillExtraction(confidence=0.0, raw_note="PDF sem texto — introduza manualmente")
    return await _extract_from_text(text)


async def extract_bill(content: bytes, content_type: Optional[str]) -> BillExtraction:
    ct = (content_type or "").lower()
    if ct.startswith("image/"):
        return await extract_from_image(content, ct)
    if "pdf" in ct:
        return await extract_from_pdf(content)
    # Tentar imagem por omissão (muitos uploads vêm como octet-stream).
    return await extract_from_image(content, "image/jpeg")
