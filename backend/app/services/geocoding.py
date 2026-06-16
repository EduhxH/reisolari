"""Address validation via the Mapbox Geocoding API.

Confirms that a shipping address actually resolves to a real Portuguese street or
postcode before an order is accepted, and returns the normalized address plus
coordinates. Used server-side (authoritative) and mirrored on the client for UX.
"""

import logging
from typing import Optional
from urllib.parse import quote

import httpx
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

MAPBOX_GEOCODE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"

# A confident match for a real street/postcode. Locality/region-only matches mean
# the street itself was not found, so they do not pass.
MIN_RELEVANCE = 0.6
ACCEPTED_PLACE_TYPES = {"address", "postcode"}


class AddressValidationResult(BaseModel):
    valid: bool
    normalized: Optional[str] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    relevance: float = 0.0
    reason: Optional[str] = None


async def validate_address(
    address_line: str,
    city: str,
    postal_code: str,
) -> AddressValidationResult:
    if not settings.MAPBOX_TOKEN:
        # Without a token we cannot verify; do not block the order but flag it.
        return AddressValidationResult(
            valid=True, reason="validation_unavailable", relevance=0.0
        )

    query = ", ".join(part for part in [address_line, f"{postal_code} {city}".strip()] if part)
    params = {
        "access_token": settings.MAPBOX_TOKEN,
        "country": "pt",
        "language": "pt",
        "limit": 1,
        "types": "address,postcode",
        "autocomplete": "false",
    }

    url = MAPBOX_GEOCODE_URL.format(query=quote(query, safe=""))
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("Mapbox geocoding failed: %s", exc)
        return AddressValidationResult(valid=True, reason="validation_unavailable")

    features = data.get("features", [])
    if not features:
        return AddressValidationResult(
            valid=False, reason="not_found", relevance=0.0
        )

    best = features[0]
    relevance = float(best.get("relevance", 0.0))
    place_types = set(best.get("place_type", []))

    if relevance >= MIN_RELEVANCE and place_types & ACCEPTED_PLACE_TYPES:
        center = best.get("center", [None, None])
        return AddressValidationResult(
            valid=True,
            normalized=best.get("place_name"),
            longitude=center[0],
            latitude=center[1],
            relevance=relevance,
        )

    return AddressValidationResult(
        valid=False,
        normalized=best.get("place_name"),
        relevance=relevance,
        reason="low_confidence",
    )
