from typing import Optional
import httpx
from pydantic import BaseModel

PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc"


class PVGISResult(BaseModel):
    E_y: float  # kWh/kWp/year


async def fetch_pvgis_irradiation(latitude: float, longitude: float) -> Optional[PVGISResult]:
    params = {
        "lat": latitude,
        "lon": longitude,
        "peakpower": 1.0,  # 1 kWp para obter energia específica
        "loss": 14,        # perdas padrão (não usado diretamente na tua fórmula E)
        "angle": 35,       # inclinação típica em PT
        "aspect": 0,       # sul
        "outputformat": "json",
    }
    timeout = httpx.Timeout(15.0, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.get(PVGIS_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, ValueError):
            return None

    try:
        # E_y: annual energy production per kWp (kWh/kWp/year)
        E_y = float(data["outputs"]["totals"]["fixed"]["E_y"])
        return PVGISResult(E_y=E_y)
    except Exception:
        return None
