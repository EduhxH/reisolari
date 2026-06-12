from pydantic import BaseModel, Field
from typing import Literal, Any, Dict

from app.schemas.panel import PanelRecommendation


class SimulationRequest(BaseModel):
    theme: str
    area_m2: float = Field(..., gt=0)
    installed_power_kwp: float = Field(..., ge=0)
    panel_efficiency: float = Field(..., gt=0, le=0.35)
    performance_ratio: float = Field(..., gt=0, le=1)
    electricity_price_eur_kwh: float = Field(..., ge=0)
    has_social_tariff: bool
    region_type: Literal["continent", "madeira", "azores"]
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    tilt_degrees: float = Field(default=35, ge=0, le=90)
    aspect_degrees: float = Field(default=0, ge=-180, le=180)


class SimulationResponse(BaseModel):
    annual_energy_kwh: float
    fiscal: Dict[str, Any]
    recommendations: list[PanelRecommendation]
    orchestrator_output: Dict[str, Any]
