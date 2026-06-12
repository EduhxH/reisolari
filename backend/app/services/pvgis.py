from typing import Optional

import httpx
from pydantic import BaseModel

PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc"


class PVGISResult(BaseModel):
    E_y: float  # kWh/kWp/year


async def fetch_pvgis_irradiation(
    latitude: float,
    longitude: float,
    angle: float = 35,
    aspect: float = 0,
) -> Optional[PVGISResult]:
    params = {
        "lat": latitude,
        "lon": longitude,
        "peakpower": 1.0,
        "loss": 14,
        "angle": angle,
        "aspect": aspect,
        "outputformat": "json",
    }
    timeout = httpx.Timeout(15.0, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.get(PVGIS_URL, params=params)
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError):
            return None

    try:
        return PVGISResult(E_y=float(data["outputs"]["totals"]["fixed"]["E_y"]))
    except (KeyError, TypeError, ValueError):
        return None
