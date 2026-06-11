from typing import Optional, Literal
import httpx
from fastapi import Request
from pydantic import BaseModel

IPAPI_URL = "https://ipapi.co/{ip}/json/"

# Fallback IP português (Lisboa) para testes em localhost
FALLBACK_PT_IP = "193.137.92.1"  # IP de rede académica PT, apenas para testes

RegionType = Literal["continent", "madeira", "azores"]


class GeoIPInfo(BaseModel):
    ip: str
    country: str
    region: str
    city: str
    latitude: float
    longitude: float
    region_type: RegionType


def map_region_to_tax_region(region: str) -> RegionType:
    r = region.lower()
    if "madeira" in r:
        return "madeira"
    if "azores" in r or "açores" in r:
        return "azores"
    return "continent"


async def get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if xff:
        ip = xff.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else FALLBACK_PT_IP

    if ip.startswith("127.") or ip == "localhost":
        return FALLBACK_PT_IP
    return ip


async def fetch_geoip_info(request: Request) -> Optional[GeoIPInfo]:
    ip = await get_client_ip(request)
    url = IPAPI_URL.format(ip=ip)
    timeout = httpx.Timeout(5.0, connect=3.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, ValueError):
            return None

    try:
        region_type = map_region_to_tax_region(data.get("region", ""))
        return GeoIPInfo(
            ip=data.get("ip", ip),
            country=data.get("country_name", ""),
            region=data.get("region", ""),
            city=data.get("city", ""),
            latitude=float(data.get("latitude")),
            longitude=float(data.get("longitude")),
            region_type=region_type,
        )
    except Exception:
        return None
