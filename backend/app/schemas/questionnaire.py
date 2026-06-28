"""Questionnaire input and result schemas.

The questionnaire is the user's primary onboarding action. It is intentionally
short and precise (guião do professor): consumption, region, usage, roof area,
desired self-sufficiency, plus economic context. An optional electricity bill can
pre-fill the consumption via AI vision extraction.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.solution import SolutionArchetype
from app.services.questionnaire_validation import hard_limit_error
from app.services.solar_sizing import ALLOWED_COVERAGE

Region = Literal["norte", "centro", "sul", "madeira", "acores"]
Priority = Literal["custo", "equilibrio", "eficiencia"]


class Questionnaire(BaseModel):
    # --- Consumo ---
    consumption_period: Literal["anual", "mensal"] = "anual"
    consumption_kwh: float = Field(..., gt=0, description="Consumo no período indicado")

    # --- Região / utilização ---
    region: Region
    usage_type: Literal["habitacao", "empresa"] = "habitacao"

    # --- Telhado ---
    available_area_m2: float = Field(default=0, ge=0)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    tilt_degrees: float = Field(default=35, ge=0, le=90)
    aspect_degrees: float = Field(default=0, ge=-180, le=180)

    # --- Objetivo ---
    coverage: float = Field(default=0.75, description="Autossuficiência: 0.25/0.5/0.75/1.0")
    priority: Priority = "equilibrio"

    # --- Económico ---
    electricity_price_eur_kwh: float = Field(default=0.20, ge=0)
    has_social_tariff: bool = False
    wants_battery: bool = False
    battery_cost_eur: float = Field(default=0, ge=0)
    # Orçamento total para o sistema (com IVA real). 0/None = sem limite.
    budget_eur: Optional[float] = Field(default=None, ge=0)

    # --- Fatura (opcional) ---
    bill_filename: Optional[str] = None

    @field_validator("coverage")
    @classmethod
    def _coverage_allowed(cls, value: float) -> float:
        if round(value, 2) not in ALLOWED_COVERAGE:
            raise ValueError(f"Cobertura tem de ser uma de {ALLOWED_COVERAGE}")
        return round(value, 2)

    @model_validator(mode="after")
    def _within_realistic_bounds(self) -> "Questionnaire":
        """Recusa dados impossíveis (absurdos/irreais). Os valores possíveis mas
        fora do normal não são bloqueados aqui — o frontend mostra para esses uma
        confirmação "tens a certeza?" (ver ``soft_warnings``)."""
        error = hard_limit_error(
            consumption_kwh=self.consumption_kwh,
            consumption_period=self.consumption_period,
            available_area_m2=self.available_area_m2,
            electricity_price_eur_kwh=self.electricity_price_eur_kwh,
            wants_battery=self.wants_battery,
            battery_cost_eur=self.battery_cost_eur,
            usage_type=self.usage_type,
            budget_eur=self.budget_eur,
        )
        if error:
            raise ValueError(error)
        return self

    @property
    def annual_consumption_kwh(self) -> float:
        return self.consumption_kwh * (12 if self.consumption_period == "mensal" else 1)


class IdealPanel(BaseModel):
    """A real panel offer sourced for the user (P2P / OLX / external PT store)."""

    source: Literal["p2p", "olx", "loja"]
    source_label: str
    title: str
    price_eur: Optional[float] = None
    price_display: str
    url: str
    image_url: Optional[str] = None
    power_w: Optional[int] = None
    location: Optional[str] = None
    match_score: float = 0.0
    match_reason: str = ""


class QuestionnaireResult(BaseModel):
    """Frontend-safe result — contains NUMBERS only, never agent prose."""

    annual_consumption_kwh: float
    region: str
    region_yield_kwh_kwp_year: float
    pvgis_yield_kwh_kwp_year: Optional[float] = None
    recommended_archetype: str
    formula_steps: List[Dict[str, Any]]
    solutions: List[SolutionArchetype]
    analysis: Dict[str, Any]            # StructuredAnalysis.model_dump()
    ideal_panels: List[IdealPanel] = []
    created_at: Optional[str] = None


class BillExtraction(BaseModel):
    """AI-extracted fields from an electricity bill, for user review/override."""

    annual_consumption_kwh: Optional[float] = None
    monthly_consumption_kwh: Optional[float] = None
    contracted_power_kva: Optional[float] = None
    price_eur_kwh: Optional[float] = None
    supplier: Optional[str] = None
    has_social_tariff: Optional[bool] = None
    confidence: float = 0.0
    raw_note: str = ""
