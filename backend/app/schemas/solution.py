from typing import Any, Dict, Literal

from pydantic import BaseModel

from app.schemas.panel import PanelSpec

Archetype = Literal["economica", "equilibrada", "premium"]


class SolutionArchetype(BaseModel):
    """One of the three proposals required by the guide (Económica/Equilibrada/Premium).

    Every solution is built from a real catalog panel and carries both VAT
    scenarios so the user (and the report) can compare the legal reduced rate
    against the professor's standard-rate guide.
    """

    archetype: Archetype
    archetype_label: str
    panel: PanelSpec
    panels_required: int
    panels_feasible: int
    fits_in_area: bool
    installed_power_kwp: float
    used_area_m2: float
    achievable_coverage: float
    annual_production_kwh: float
    net_system_cost_eur: float          # ex-IVA (painéis + BOS)
    fiscal_real: Dict[str, Any]         # FiscalResult (cenário real)
    fiscal_guiao: Dict[str, Any]        # FiscalResult (cenário guião)
    co2_annual_kg: float
    co2_lifetime_kg: float
