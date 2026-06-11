from pydantic import BaseModel
from typing import Literal, Any, Dict


class SimulationRequest(BaseModel):
    theme: str
    area_m2: float
    installed_power_kwp: float
    panel_efficiency: float
    performance_ratio: float
    electricity_price_eur_kwh: float
    has_social_tariff: bool
    region_type: Literal["continent", "madeira", "azores"]
    latitude: float
    longitude: float


class SimulationResponse(BaseModel):
    annual_energy_kwh: float
    fiscal: Dict[str, Any]
    orchestrator_output: Dict[str, Any]
