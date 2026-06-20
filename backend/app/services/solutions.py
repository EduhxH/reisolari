"""Build the three required proposals (Económica / Equilibrada / Premium).

Consumption-driven: for every real catalog panel we size the system with the
professor's formulas, constrain it to the roof area, then price it under both VAT
scenarios. The three archetypes are then chosen by distinct, defensible metrics:

- Económica   → menor custo total (IVA real).
- Premium     → maior eficiência do módulo (⇒ menor área ocupada).
- Equilibrada → melhor relação custo/produção ao longo da vida útil (€/kWh).
"""

from __future__ import annotations

from typing import Optional

from app.schemas.panel import PanelSpec
from app.schemas.solution import Archetype, SolutionArchetype
from app.services.fiscal import FiscalInput, compute_fiscal_scenarios
from app.services.solar_sizing import (
    apply_area_constraint,
    co2_avoided,
    lifetime_energy_kwh,
    region_to_fiscal,
    size_system,
)

# Custo do balanço do sistema (inversor + estrutura + mão de obra), líquido de IVA,
# por kWp instalado. Soma-se ao custo dos módulos do catálogo para um custo de
# sistema realista. Constante única e auditável.
BOS_COST_PER_KWP_EUR = 450.0

ARCHETYPE_LABELS: dict[Archetype, str] = {
    "economica": "Económica — menor custo",
    "equilibrada": "Equilibrada — melhor relação preço/produção",
    "premium": "Premium — maior eficiência e menor área",
}


class _Candidate:
    """Intermediate per-panel computation used to pick the archetypes."""

    def __init__(self, panel: PanelSpec, solution: SolutionArchetype, lifetime_kwh: float):
        self.panel = panel
        self.solution = solution
        self.lifetime_kwh = lifetime_kwh

    @property
    def total_cost_real(self) -> float:
        return float(self.solution.fiscal_real["total_cost_with_vat"])

    @property
    def cost_per_lifetime_kwh(self) -> float:
        return self.total_cost_real / self.lifetime_kwh if self.lifetime_kwh > 0 else float("inf")


def _build_candidate(
    panel: PanelSpec,
    *,
    annual_consumption_kwh: float,
    coverage: float,
    region: str,
    available_area_m2: float,
    electricity_price_eur_kwh: float,
    has_social_tariff: bool,
    battery_cost_eur: float,
) -> Optional[_Candidate]:
    sizing = size_system(annual_consumption_kwh, coverage, region, panel.power_w)

    # Restrição de área (só se o utilizador indicou uma área de telhado).
    if available_area_m2 and available_area_m2 > 0:
        constraint = apply_area_constraint(
            sizing,
            panel.width_mm / 1000,
            panel.height_mm / 1000,
            available_area_m2,
        )
        panels_feasible = constraint.panels_feasible
        fits = constraint.fits
        used_area = constraint.used_area_m2
        achievable_coverage = constraint.achievable_coverage
    else:
        panels_feasible = sizing.panels_required
        fits = True
        used_area = panels_feasible * (panel.width_mm / 1000) * (panel.height_mm / 1000)
        achievable_coverage = coverage

    if panels_feasible <= 0:
        return None

    installed_kwp = panels_feasible * panel.power_w / 1000
    annual_production = installed_kwp * sizing.region_yield_kwh_kwp_year
    equipment_cost = panels_feasible * panel.avg_price_eur
    net_system_cost = equipment_cost + installed_kwp * BOS_COST_PER_KWP_EUR

    fiscal_input = FiscalInput(
        region=region_to_fiscal(region),
        panel_system_cost_eur=net_system_cost,
        battery_cost_eur=battery_cost_eur,
        annual_energy_kwh=annual_production,
        electricity_price_eur_kwh=electricity_price_eur_kwh,
        has_social_tariff=has_social_tariff,
    )
    scenarios = compute_fiscal_scenarios(fiscal_input)
    co2 = co2_avoided(annual_production)
    lifetime_kwh = lifetime_energy_kwh(annual_production)

    solution = SolutionArchetype(
        archetype="economica",  # provisório; definido ao escolher o arquétipo
        archetype_label="",
        panel=panel,
        panels_required=sizing.panels_required,
        panels_feasible=panels_feasible,
        fits_in_area=fits,
        installed_power_kwp=installed_kwp,
        used_area_m2=used_area,
        achievable_coverage=achievable_coverage,
        annual_production_kwh=annual_production,
        net_system_cost_eur=net_system_cost,
        fiscal_reduzido=scenarios["reduzido"].model_dump(),
        fiscal_real=scenarios["real"].model_dump(),
        fiscal_guiao=scenarios["guiao"].model_dump(),
        co2_annual_kg=co2.annual_kg,
        co2_lifetime_kg=co2.lifetime_kg,
    )
    return _Candidate(panel, solution, lifetime_kwh)


def _label(candidate: _Candidate, archetype: Archetype) -> SolutionArchetype:
    return candidate.solution.model_copy(
        update={"archetype": archetype, "archetype_label": ARCHETYPE_LABELS[archetype]}
    )


def build_solutions(
    catalog: list[PanelSpec],
    *,
    annual_consumption_kwh: float,
    coverage: float,
    region: str,
    available_area_m2: float = 0.0,
    electricity_price_eur_kwh: float = 0.20,
    has_social_tariff: bool = False,
    battery_cost_eur: float = 0.0,
    budget_eur: float | None = None,
) -> list[SolutionArchetype]:
    """Devolve as 3 soluções (económica, equilibrada, premium), nesta ordem.

    Escolhe módulos distintos quando possível; se o catálogo tiver poucos painéis,
    um módulo pode servir mais do que um arquétipo.

    Se ``budget_eur`` for indicado, é um **filtro rígido**: só entram painéis cujo
    sistema completo (IVA real) caiba no orçamento. Se nenhum couber, levanta
    ``ValueError`` com o custo mínimo, para o utilizador poder ajustar o orçamento.
    """
    candidates = [
        c
        for panel in catalog
        if (
            c := _build_candidate(
                panel,
                annual_consumption_kwh=annual_consumption_kwh,
                coverage=coverage,
                region=region,
                available_area_m2=available_area_m2,
                electricity_price_eur_kwh=electricity_price_eur_kwh,
                has_social_tariff=has_social_tariff,
                battery_cost_eur=battery_cost_eur,
            )
        )
        is not None
    ]
    if not candidates:
        return []

    # Filtro rígido de orçamento (custo total do sistema com IVA real).
    if budget_eur is not None and budget_eur > 0:
        affordable = [c for c in candidates if c.total_cost_real <= budget_eur]
        if not affordable:
            cheapest = min(c.total_cost_real for c in candidates)
            raise ValueError(
                f"Nenhuma proposta cabe no orçamento de {budget_eur:,.0f} €".replace(",", " ")
                + f". A opção mais barata (sistema completo, IVA real) custa cerca de "
                + f"{cheapest:,.0f} €".replace(",", " ")
                + ". Aumente o orçamento ou reduza a autossuficiência pretendida."
            )
        candidates = affordable

    economica = min(candidates, key=lambda c: c.total_cost_real)
    premium = max(candidates, key=lambda c: (c.panel.efficiency, -c.solution.used_area_m2))

    # Equilibrada: melhor €/kWh de vida útil, preferindo um módulo ainda não usado.
    by_value = sorted(candidates, key=lambda c: c.cost_per_lifetime_kwh)
    chosen_codes = {economica.panel.code, premium.panel.code}
    equilibrada = next(
        (c for c in by_value if c.panel.code not in chosen_codes), by_value[0]
    )

    return [
        _label(economica, "economica"),
        _label(equilibrada, "equilibrada"),
        _label(premium, "premium"),
    ]
