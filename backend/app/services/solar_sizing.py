"""Consumption-driven photovoltaic sizing engine (guião do professor).

Every function here is **pure and deterministic** — no network, no database, no
randomness — so the numbers are fully auditable for the FQ report and covered by
unit tests. The canonical method is the one defined in the professor's guide:

    ConsumoObjetivo      = ConsumoAnual × Cobertura
    PotenciaNecessaria   = ConsumoObjetivo / ProducaoRegional        [kWp]
    NumeroPaineis        = PotenciaNecessaria(W) / PotenciaPainel(W)
    ProducaoAnual        = PotenciaInstalada(kWp) × ProducaoRegional  [kWh/ano]

``ProducaoRegional`` (produção específica, kWh/kWp/ano) comes from the guide's
reference table. The location-precise value from PVGIS is computed separately
(``app.services.pvgis``) and shown side by side, never silently mixed in.
"""

from __future__ import annotations

import math
import unicodedata
from dataclasses import dataclass
from typing import Literal

Region = Literal["norte", "centro", "sul", "madeira", "acores"]
FiscalRegion = Literal["continent", "madeira", "azores"]

# Produção específica de referência por região (kWh/kWp/ano) — tabela do guião.
REGION_YIELD_KWH_KWP_YEAR: dict[str, float] = {
    "norte": 1300.0,
    "centro": 1450.0,
    "sul": 1650.0,
    "madeira": 1700.0,
    "acores": 1400.0,
}

# Coberturas de autossuficiência permitidas pelo guião.
ALLOWED_COVERAGE = (0.25, 0.50, 0.75, 1.00)

# Fator de emissão do mix elétrico português (kg CO₂eq / kWh). Ordem de grandeza
# documentada para Portugal (~0,19, coerente com APA/EEA). É uma constante única
# e auditável para ser fácil de atualizar e justificar no relatório.
PT_GRID_EMISSION_FACTOR_KG_PER_KWH = 0.19

# Equivalências documentadas para contextualizar o CO₂ evitado.
CO2_KG_ABSORVIDO_POR_ARVORE_ANO = 21.0   # absorção média de uma árvore adulta (kg/ano)
CO2_KG_POR_KM_CARRO = 0.12               # emissão média de um ligeiro a gasolina (kg/km)


def _normalize_region(region: str) -> str:
    """Lower-case and strip accents so 'Açores'/'açores'/'acores' all match."""
    text = unicodedata.normalize("NFKD", region.strip().lower())
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def region_to_fiscal(region: str) -> FiscalRegion:
    """Map a production region to its Portuguese VAT/fiscal region."""
    r = _normalize_region(region)
    if r == "madeira":
        return "madeira"
    if r == "acores":
        return "azores"
    if r in ("norte", "centro", "sul"):
        return "continent"
    raise ValueError(f"Região desconhecida: {region!r}")


def region_yield(region: str) -> float:
    """Produção específica de referência (kWh/kWp/ano) para a região."""
    r = _normalize_region(region)
    if r not in REGION_YIELD_KWH_KWP_YEAR:
        raise ValueError(f"Região desconhecida: {region!r}")
    return REGION_YIELD_KWH_KWP_YEAR[r]


@dataclass(frozen=True)
class FormulaStep:
    """One algebraic step with its numbers substituted, for the page and PDF."""
    label: str
    expression: str
    value: float
    unit: str


@dataclass(frozen=True)
class SizingResult:
    annual_consumption_kwh: float
    coverage: float
    region: str
    region_yield_kwh_kwp_year: float
    panel_power_w: int
    target_consumption_kwh: float       # ConsumoObjetivo
    required_power_kwp: float           # PotenciaNecessaria (antes de arredondar painéis)
    panels_required: int                # NumeroPaineis (arredondado para cima)
    installed_power_kwp: float          # potência real instalada (painéis × potência)
    annual_production_kwh: float        # produção com a potência instalada


def size_system(
    annual_consumption_kwh: float,
    coverage: float,
    region: str,
    panel_power_w: int,
) -> SizingResult:
    """Aplica as fórmulas do guião para dimensionar o sistema.

    A produção anual usa a **potência instalada** (painéis inteiros × potência do
    painel), que é ≥ à potência necessária por causa do arredondamento para cima
    de ``NumeroPaineis`` — mantém o sistema consistente (nº de painéis × potência
    == potência instalada == base da produção).
    """
    if annual_consumption_kwh <= 0:
        raise ValueError("Consumo anual tem de ser positivo.")
    if not 0 < coverage <= 1:
        raise ValueError("Cobertura tem de estar em (0, 1].")
    if panel_power_w <= 0:
        raise ValueError("Potência do painel tem de ser positiva.")

    yield_ = region_yield(region)
    target = annual_consumption_kwh * coverage
    required_kwp = target / yield_
    panels_required = max(1, math.ceil((required_kwp * 1000.0) / panel_power_w))
    installed_kwp = panels_required * panel_power_w / 1000.0
    annual_production = installed_kwp * yield_

    return SizingResult(
        annual_consumption_kwh=annual_consumption_kwh,
        coverage=coverage,
        region=_normalize_region(region),
        region_yield_kwh_kwp_year=yield_,
        panel_power_w=panel_power_w,
        target_consumption_kwh=target,
        required_power_kwp=required_kwp,
        panels_required=panels_required,
        installed_power_kwp=installed_kwp,
        annual_production_kwh=annual_production,
    )


def formula_steps(result: SizingResult) -> list[FormulaStep]:
    """As 3 fórmulas do guião com os números substituídos (para página/PDF)."""
    r = result
    return [
        FormulaStep(
            label="Consumo objetivo",
            expression=(
                f"ConsumoObjetivo = {r.annual_consumption_kwh:.0f} kWh × "
                f"{r.coverage:.0%}"
            ),
            value=r.target_consumption_kwh,
            unit="kWh/ano",
        ),
        FormulaStep(
            label="Potência necessária",
            expression=(
                f"PotenciaNecessaria = {r.target_consumption_kwh:.0f} ÷ "
                f"{r.region_yield_kwh_kwp_year:.0f}"
            ),
            value=r.required_power_kwp,
            unit="kWp",
        ),
        FormulaStep(
            label="Número de painéis",
            expression=(
                f"NumeroPaineis = {r.required_power_kwp * 1000:.0f} W ÷ "
                f"{r.panel_power_w} W"
            ),
            value=float(r.panels_required),
            unit="painéis",
        ),
    ]


# --- Restrição de área do telhado --------------------------------------------

@dataclass(frozen=True)
class AreaConstraint:
    max_panels_by_area: int
    panels_feasible: int
    fits: bool
    used_area_m2: float
    achievable_coverage: float


def apply_area_constraint(
    sizing: SizingResult,
    panel_width_m: float,
    panel_height_m: float,
    available_area_m2: float,
    packing_factor: float = 0.78,
    spacing_m: float = 0.05,
) -> AreaConstraint:
    """Limita o nº de painéis pela área útil do telhado.

    Usa a mesma lógica de packing do ``panel_recommender`` (área de colocação com
    espaçamento + fator de ocupação), para que telhado e recomendações sejam
    coerentes. Se a área não chegar, devolve a cobertura realmente atingível.
    """
    placement_area = (panel_width_m + spacing_m) * (panel_height_m + spacing_m)
    usable_area = max(0.0, available_area_m2) * packing_factor
    max_by_area = int(math.floor(usable_area / placement_area)) if placement_area > 0 else 0

    feasible = min(sizing.panels_required, max_by_area)
    fits = max_by_area >= sizing.panels_required
    used_area = feasible * (panel_width_m * panel_height_m)

    # Cobertura realmente atingível com os painéis que cabem.
    if sizing.panels_required > 0:
        achievable = sizing.coverage * (feasible / sizing.panels_required)
    else:
        achievable = 0.0

    return AreaConstraint(
        max_panels_by_area=max_by_area,
        panels_feasible=feasible,
        fits=fits,
        used_area_m2=used_area,
        achievable_coverage=min(sizing.coverage, achievable),
    )


# --- CO₂ evitado --------------------------------------------------------------

def lifetime_energy_kwh(
    annual_production_kwh: float,
    analysis_years: int = 25,
    annual_degradation_rate: float = 0.005,
) -> float:
    """Energia total ao longo da vida útil, com degradação anual composta.

    Mesma convenção de degradação do modelo fiscal (0,5%/ano), para que produção,
    poupança e CO₂ sejam todos consistentes entre si.
    """
    return sum(
        annual_production_kwh * ((1 - annual_degradation_rate) ** year)
        for year in range(analysis_years)
    )


@dataclass(frozen=True)
class Co2Result:
    annual_kg: float
    lifetime_kg: float
    equivalent_trees: float
    equivalent_car_km: float


def co2_avoided(
    annual_production_kwh: float,
    analysis_years: int = 25,
    annual_degradation_rate: float = 0.005,
    emission_factor_kg_per_kwh: float = PT_GRID_EMISSION_FACTOR_KG_PER_KWH,
) -> Co2Result:
    """CO₂ evitado por substituição de eletricidade da rede.

    O CO₂ ao longo da vida útil usa a mesma degradação anual do modelo fiscal
    (0,5%/ano por omissão), para que produção e poupança/CO₂ sejam coerentes.
    """
    annual = annual_production_kwh * emission_factor_kg_per_kwh
    lifetime_kwh = lifetime_energy_kwh(
        annual_production_kwh, analysis_years, annual_degradation_rate
    )
    lifetime = lifetime_kwh * emission_factor_kg_per_kwh
    return Co2Result(
        annual_kg=annual,
        lifetime_kg=lifetime,
        equivalent_trees=lifetime / CO2_KG_ABSORVIDO_POR_ARVORE_ANO,
        equivalent_car_km=lifetime / CO2_KG_POR_KM_CARRO,
    )
