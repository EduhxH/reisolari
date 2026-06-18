"""Deterministic structured analysis (the numbers the user sees).

The physics/finance/sustainability "results" are computed here from the already
validated sizing/fiscal/CO₂ numbers — no LLM, so they are rigorous and testable.
The LLM is used only for the hidden prose (``app.agents.reasoning``), which never
reaches the frontend.
"""

from __future__ import annotations

from typing import Literal, Optional

from app.agents.base import (
    AnalystVerdict,
    FinanceIndicators,
    PhysicsIndicators,
    StructuredAnalysis,
    SustainabilityIndicators,
)
from app.schemas.solution import Archetype, SolutionArchetype

Priority = Literal["custo", "equilibrio", "eficiencia"]

# Indicadores térmicos (informativos). O coeficiente é típico de módulos N-type
# TOPCon; a produção regional já embute perdas reais, por isso isto é só para
# explicar o porquê de PR < 1, não é reaplicado à produção.
PANEL_TEMP_COEFFICIENT_PER_C = -0.0035
REPRESENTATIVE_AMBIENT_C: dict[str, float] = {
    "continent": 25.0,
    "madeira": 23.0,
    "azores": 21.0,
}
CELL_TEMP_RISE_C = 25.0   # subida típica da célula sob ~1 kW/m² acima do ambiente
STC_TEMP_C = 25.0

PRIORITY_TO_ARCHETYPE: dict[Priority, Archetype] = {
    "custo": "economica",
    "equilibrio": "equilibrada",
    "eficiencia": "premium",
}


def select_recommended_archetype(
    solutions: list[SolutionArchetype],
    priority: Optional[Priority] = None,
) -> tuple[Archetype, float, bool]:
    """Escolhe o arquétipo que favorece este utilizador (lógica determinística).

    Prefere uma solução que caiba na área. Se a preferência do utilizador couber,
    usa-a com alta confiança; caso contrário recai numa que caiba (confiança menor).
    Devolve (arquétipo, confiança, cabe_na_área).
    """
    if not solutions:
        return "equilibrada", 0.0, False

    by_archetype = {s.archetype: s for s in solutions}
    desired: Archetype = PRIORITY_TO_ARCHETYPE.get(priority or "equilibrio", "equilibrada")

    desired_solution = by_archetype.get(desired)
    if desired_solution is not None and desired_solution.fits_in_area:
        return desired, 0.9, True

    # A preferida não cabe (ou não existe): tenta uma que caiba, mantendo ordem
    # económica → equilibrada → premium como desempate.
    order: list[Archetype] = ["equilibrada", "economica", "premium"]
    for archetype in order:
        sol = by_archetype.get(archetype)
        if sol is not None and sol.fits_in_area:
            confidence = 0.9 if archetype == desired else 0.6
            return archetype, confidence, True

    # Nenhuma cabe: fica com a preferida (ou a primeira), assinalando que não cabe.
    fallback = desired_solution or solutions[0]
    return fallback.archetype, 0.4, False


def build_structured_analysis(
    solutions: list[SolutionArchetype],
    region_fiscal: str,
    priority: Optional[Priority] = None,
) -> StructuredAnalysis:
    """Constrói os indicadores numéricos a partir da solução recomendada."""
    archetype, confidence, fits = select_recommended_archetype(solutions, priority)
    recommended = next(s for s in solutions if s.archetype == archetype)

    ambient = REPRESENTATIVE_AMBIENT_C.get(region_fiscal, 25.0)
    cell_temp = ambient + CELL_TEMP_RISE_C
    derating = 1 + PANEL_TEMP_COEFFICIENT_PER_C * (cell_temp - STC_TEMP_C)
    expected_kwp = recommended.panels_feasible * recommended.panel.power_w / 1000
    consistency_ok = abs(expected_kwp - recommended.installed_power_kwp) < 1e-6

    physics = PhysicsIndicators(
        panel_efficiency=recommended.panel.efficiency,
        temperature_coefficient_per_c=PANEL_TEMP_COEFFICIENT_PER_C,
        estimated_cell_temp_c=cell_temp,
        thermal_derating_factor=derating,
        consistency_ok=consistency_ok,
    )

    real = recommended.fiscal_real
    guiao = recommended.fiscal_guiao
    finance = FinanceIndicators(
        recommended_scenario="real",
        payback_years_real=real["payback_years"],
        payback_years_guiao=guiao["payback_years"],
        npv_eur_real=real["npv_eur"],
        irr_percent_real=real.get("irr_percent"),
        total_cost_real_eur=real["total_cost_with_vat"],
        total_cost_guiao_eur=guiao["total_cost_with_vat"],
        annual_savings_eur=real["annual_savings_eur"],
    )

    from app.services.solar_sizing import co2_avoided

    co2 = co2_avoided(recommended.annual_production_kwh)
    sustainability = SustainabilityIndicators(
        co2_annual_kg=co2.annual_kg,
        co2_lifetime_kg=co2.lifetime_kg,
        equivalent_trees=co2.equivalent_trees,
        equivalent_car_km=co2.equivalent_car_km,
    )

    analyst = AnalystVerdict(
        recommended_archetype=archetype,
        confidence=confidence,
        fits_questionnaire=fits,
    )

    return StructuredAnalysis(
        physics=physics,
        finance=finance,
        sustainability=sustainability,
        analyst=analyst,
    )
