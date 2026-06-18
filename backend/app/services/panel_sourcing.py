"""Source real solar-panel offers for the user's "Ideais" menu.

Three real sources, queried in parallel:
  - P2P interno  : active listings in our own marketplace (db.listings).
  - OLX          : live OLX Portugal ads (app.services.olx_scraper).
  - Lojas (SerpAPI): Google Shopping results from Portuguese stores.

Each candidate is scored rigorously against the user's required specs (keyword
relevance, panel power proximity, sane per-panel price). The LLM reranking pass
(app.agents.agent_sourcing) refines the order and never blocks the result.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Optional

import httpx

from app.core.config import settings
from app.db.mongo import get_db_client
from app.schemas.questionnaire import IdealPanel
from app.services.olx_scraper import fetch_olx_ads

logger = logging.getLogger(__name__)

SERPAPI_URL = "https://serpapi.com/search.json"
SOLAR_KEYWORDS = ("painel", "paineis", "painéis", "fotovolta", "modulo solar", "módulo solar", "placa solar")
NEGATIVE_KEYWORDS = ("suporte", "cabo", "conector", "carregador", "lanterna", "powerbank", "calculadora")

_POWER_RE = re.compile(r"(\d{3,4})\s*[wW]p?\b")
_PRICE_RE = re.compile(r"(\d[\d\.\s]*,?\d*)\s*€|€\s*(\d[\d\.\s]*,?\d*)")


def _parse_power_w(text: str) -> Optional[int]:
    for match in _POWER_RE.finditer(text or ""):
        value = int(match.group(1))
        if 100 <= value <= 800:  # gama plausível para um módulo residencial
            return value
    return None


def _is_relevant(title: str) -> bool:
    low = (title or "").lower()
    if any(neg in low for neg in NEGATIVE_KEYWORDS):
        return False
    return any(kw in low for kw in SOLAR_KEYWORDS)


def _score(panel: IdealPanel, target_power_w: int, budget_per_panel: Optional[float]) -> tuple[float, str]:
    score = 0.5
    reasons: list[str] = []

    if panel.power_w:
        diff = abs(panel.power_w - target_power_w)
        proximity = max(0.0, 1 - diff / target_power_w)
        score += 0.3 * proximity
        if proximity > 0.85:
            reasons.append(f"potência {panel.power_w} W próxima do alvo")
    if panel.price_eur and panel.price_eur > 0:
        if 50 <= panel.price_eur <= 600:
            score += 0.15
            reasons.append("preço por módulo plausível")
        if budget_per_panel and panel.price_eur <= budget_per_panel * 1.1:
            score += 0.1
            reasons.append("dentro do orçamento")
    if panel.source == "p2p":
        score += 0.05  # favorece o nosso marketplace
    return min(1.0, score), "; ".join(reasons) or "corresponde à pesquisa"


async def _source_p2p(target_power_w: int, limit: int = 12) -> list[IdealPanel]:
    try:
        db = get_db_client().solar_p2p
        regex = {"$regex": "painel|painéis|fotovolta|solar", "$options": "i"}
        cursor = db.listings.find(
            {"active": True, "status": "active", "$or": [{"title": regex}, {"description": regex}]}
        ).limit(limit)
        out: list[IdealPanel] = []
        async for doc in cursor:
            title = doc.get("title", "")
            if not _is_relevant(title):
                continue
            price = doc.get("price_cents", 0) / 100 if doc.get("price_cents") else None
            images = doc.get("image_urls") or []
            out.append(
                IdealPanel(
                    source="p2p",
                    source_label="Marketplace Reisolari",
                    title=title,
                    price_eur=price,
                    price_display=f"{price:.0f} €" if price else "Sob consulta",
                    url=f"{settings.FRONTEND_PUBLIC_URL}/anuncio/{doc['_id']}",
                    image_url=images[0] if images else None,
                    power_w=_parse_power_w(f"{title} {doc.get('description','')}"),
                    location=doc.get("city"),
                )
            )
        return out
    except Exception as exc:
        logger.warning("P2P sourcing failed: %s", exc)
        return []


async def _source_olx(lat: Optional[float], lon: Optional[float], limit: int = 12) -> list[IdealPanel]:
    try:
        ads = await fetch_olx_ads(lat, lon)
    except Exception as exc:
        logger.warning("OLX sourcing failed: %s", exc)
        return []
    out: list[IdealPanel] = []
    for ad in ads:
        if not _is_relevant(ad.title):
            continue
        price = ad.price_cents / 100 if ad.price_cents else None
        out.append(
            IdealPanel(
                source="olx",
                source_label="OLX Portugal",
                title=ad.title,
                price_eur=price,
                price_display=ad.price_display,
                url=ad.url,
                image_url=ad.image_url,
                power_w=_parse_power_w(f"{ad.title} {ad.description}"),
                location=ad.location,
            )
        )
        if len(out) >= limit:
            break
    return out


async def _source_serpapi(query: str, limit: int = 16) -> list[IdealPanel]:
    if not settings.SERPAPI_API_KEY:
        return []
    params = {
        "engine": "google_shopping",
        "q": query,
        "gl": "pt",
        "hl": "pt",
        "google_domain": "google.pt",
        "num": str(limit * 2),
        "api_key": settings.SERPAPI_API_KEY,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(SERPAPI_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("SerpAPI sourcing failed: %s", exc)
        return []

    out: list[IdealPanel] = []
    for item in data.get("shopping_results", []):
        title = item.get("title", "")
        if not _is_relevant(title):
            continue
        price = item.get("extracted_price")
        out.append(
            IdealPanel(
                source="loja",
                source_label=item.get("source") or "Loja online",
                title=title,
                price_eur=float(price) if isinstance(price, (int, float)) else None,
                price_display=item.get("price") or "Sob consulta",
                url=item.get("product_link") or item.get("link") or "",
                image_url=item.get("thumbnail"),
                power_w=_parse_power_w(title),
                location="Portugal",
            )
        )
        if len(out) >= limit:
            break
    return out


async def source_ideal_panels(
    *,
    target_power_w: int,
    target_power_kwp: float,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    budget_per_panel: Optional[float] = None,
    max_items: int = 12,
) -> list[IdealPanel]:
    """Recolhe, pontua e ordena ofertas reais das três fontes."""
    query = f"painel solar fotovoltaico {target_power_w}W"
    p2p, olx, loja = await asyncio.gather(
        _source_p2p(target_power_w),
        _source_olx(latitude, longitude),
        _source_serpapi(query),
    )
    candidates = [*p2p, *olx, *loja]

    scored: list[IdealPanel] = []
    seen_urls: set[str] = set()
    for panel in candidates:
        if panel.url in seen_urls:
            continue
        seen_urls.add(panel.url)
        score, reason = _score(panel, target_power_w, budget_per_panel)
        scored.append(panel.model_copy(update={"match_score": score, "match_reason": reason}))

    scored.sort(key=lambda p: p.match_score, reverse=True)
    top = scored[: max_items * 2]

    # Reranking por LLM (rigoroso); falha → mantém a ordem determinística.
    try:
        from app.agents.agent_sourcing import rerank_panels

        top = await rerank_panels(top, target_power_w=target_power_w, target_power_kwp=target_power_kwp)
    except Exception as exc:
        logger.warning("LLM rerank skipped: %s", exc)

    return top[:max_items]
