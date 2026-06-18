from typing import Optional

from pydantic import BaseModel


class AgentResponse(BaseModel):
    role: str
    content: str


class OrchestratorOutput(BaseModel):
    physics_analysis: AgentResponse
    financial_analysis: AgentResponse
    sustainability_analysis: AgentResponse
    summary: str


# --- Structured analysis (números) — o que o utilizador VÊ -------------------
# A prosa dos agentes (reasoning) fica só no backend; estes indicadores numéricos
# são os "resultados da análise" que aparecem na página e no orçamento PDF.


class PhysicsIndicators(BaseModel):
    panel_efficiency: float                 # eficiência nominal do módulo (fração)
    temperature_coefficient_per_c: float    # coef. de potência (ex.: -0.0035 /°C)
    estimated_cell_temp_c: float            # temperatura de célula estimada
    thermal_derating_factor: float          # fator térmico vs STC (≈0.90)
    consistency_ok: bool                    # nº painéis × potência == kWp instalado


class FinanceIndicators(BaseModel):
    recommended_scenario: str               # "real" (taxa reduzida legal)
    payback_years_real: float
    payback_years_guiao: float
    npv_eur_real: float
    irr_percent_real: Optional[float]
    total_cost_real_eur: float
    total_cost_guiao_eur: float
    annual_savings_eur: float


class SustainabilityIndicators(BaseModel):
    co2_annual_kg: float
    co2_lifetime_kg: float
    equivalent_trees: float
    equivalent_car_km: float


class AnalystVerdict(BaseModel):
    recommended_archetype: str              # economica | equilibrada | premium
    confidence: float                       # 0..1
    fits_questionnaire: bool                # a solução recomendada cabe na área?


class StructuredAnalysis(BaseModel):
    """Resultados numéricos consolidados — enviados ao frontend/PDF."""

    physics: PhysicsIndicators
    finance: FinanceIndicators
    sustainability: SustainabilityIndicators
    analyst: AnalystVerdict


class BackendReasoning(BaseModel):
    """Prosa explicativa dos agentes — guardada só no backend, NUNCA no frontend."""

    physics: str = ""
    finance: str = ""
    sustainability: str = ""
    analyst: str = ""
