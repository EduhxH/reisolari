"""Pure orchestration of a questionnaire simulation.

Combines sizing + the three solutions + the deterministic structured analysis into
a frontend-safe ``QuestionnaireResult``. No DB, no LLM, no network here, so the
whole assembly is unit-testable; the API layer injects the real catalog, the
PVGIS yield, the hidden reasoning and the sourced panels.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Optional

from app.agents.base import StructuredAnalysis
from app.schemas.panel import PanelSpec
from app.schemas.questionnaire import Questionnaire, QuestionnaireResult
from app.services.analysis import build_structured_analysis
from app.services.solar_sizing import (
    formula_steps,
    region_to_fiscal,
    region_yield,
    size_system,
)
from app.services.solutions import build_solutions


def run_questionnaire_simulation(
    questionnaire: Questionnaire,
    catalog: list[PanelSpec],
    pvgis_yield: Optional[float] = None,
) -> tuple[QuestionnaireResult, StructuredAnalysis]:
    """Devolve (resultado seguro para o frontend, análise estruturada completa)."""
    if not catalog:
        raise ValueError("Catálogo de painéis vazio — não é possível dimensionar.")

    annual = questionnaire.annual_consumption_kwh
    battery_cost = questionnaire.battery_cost_eur if questionnaire.wants_battery else 0.0

    solutions = build_solutions(
        catalog,
        annual_consumption_kwh=annual,
        coverage=questionnaire.coverage,
        region=questionnaire.region,
        available_area_m2=questionnaire.available_area_m2,
        electricity_price_eur_kwh=questionnaire.electricity_price_eur_kwh,
        has_social_tariff=questionnaire.has_social_tariff,
        battery_cost_eur=battery_cost,
    )
    if not solutions:
        raise ValueError("Não foi possível construir soluções para os dados fornecidos.")

    analysis = build_structured_analysis(
        solutions,
        region_fiscal=region_to_fiscal(questionnaire.region),
        priority=questionnaire.priority,
    )
    recommended = analysis.analyst.recommended_archetype
    rec_solution = next(s for s in solutions if s.archetype == recommended)

    # As 3 fórmulas usam o painel da solução recomendada.
    sizing = size_system(annual, questionnaire.coverage, questionnaire.region, rec_solution.panel.power_w)
    steps = [asdict(step) for step in formula_steps(sizing)]

    result = QuestionnaireResult(
        annual_consumption_kwh=annual,
        region=questionnaire.region,
        region_yield_kwh_kwp_year=region_yield(questionnaire.region),
        pvgis_yield_kwh_kwp_year=pvgis_yield,
        recommended_archetype=recommended,
        formula_steps=steps,
        solutions=solutions,
        analysis=analysis.model_dump(),
        ideal_panels=[],
    )
    return result, analysis
