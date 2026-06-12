from pydantic import BaseModel


class PanelSpec(BaseModel):
    code: str
    name: str
    power_w: int
    width_mm: int
    height_mm: int
    efficiency: float
    avg_price_eur: float
    category: str
    source_note: str


class PanelRecommendation(BaseModel):
    panel: PanelSpec
    panels_fit: int
    recommended_count: int
    installed_power_kwp: float
    used_roof_area_m2: float
    roof_coverage_ratio: float
    annual_energy_kwh: float
    estimated_equipment_cost_eur: float
    annual_savings_eur: float
    simple_payback_years: float
    rationale: str
