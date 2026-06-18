from typing import Literal, Optional
from pydantic import BaseModel

RegionType = Literal["continent", "madeira", "azores"]
VatScenario = Literal["real", "guiao"]

# Taxa normal de IVA por região (Continente 23%, Madeira 22%, Açores 16%) — é o
# valor usado pelo guião do professor e o aplicado às baterias no cenário real.
STANDARD_VAT: dict[str, float] = {"continent": 0.23, "madeira": 0.22, "azores": 0.16}
# Taxa reduzida real para painéis de autoconsumo (Verba 2.34 da Lista I do CIVA).
REDUCED_PANEL_VAT: dict[str, float] = {"continent": 0.06, "madeira": 0.05, "azores": 0.04}

# Desconto da Tarifa Social de Energia aplicado ao preço da eletricidade.
SOCIAL_TARIFF_DISCOUNT = 0.338


class FiscalInput(BaseModel):
    region: RegionType
    panel_system_cost_eur: float
    battery_cost_eur: float
    annual_energy_kwh: float
    electricity_price_eur_kwh: float
    has_social_tariff: bool
    # "real": painéis com taxa reduzida (6/5/4%) e baterias com taxa normal.
    # "guiao": tudo à taxa normal regional (23/22/16%), conforme o guião do professor.
    scenario: VatScenario = "real"
    analysis_years: int = 25
    discount_rate: float = 0.04
    annual_degradation_rate: float = 0.005
    annual_maintenance_eur: float = 0.0


class FiscalResult(BaseModel):
    scenario: VatScenario
    scenario_label: str
    vat_panels_rate: float
    vat_battery_rate: float
    total_cost_with_vat: float
    effective_electricity_price_eur_kwh: float
    annual_savings_eur: float
    payback_years: float
    lifetime_savings_eur: float
    npv_eur: float
    irr_percent: Optional[float]


def get_vat_rates(region: RegionType, scenario: VatScenario = "real") -> tuple[float, float]:
    """Devolve (taxa_paineis, taxa_baterias) para a região e cenário.

    - "real": painéis com a taxa reduzida legal (6/5/4%), baterias à taxa normal.
    - "guiao": painéis e baterias à taxa normal regional (23/22/16%).
    """
    standard = STANDARD_VAT.get(region, STANDARD_VAT["continent"])
    if scenario == "guiao":
        return standard, standard
    reduced = REDUCED_PANEL_VAT.get(region, REDUCED_PANEL_VAT["continent"])
    return reduced, standard


def _scenario_label(scenario: VatScenario) -> str:
    if scenario == "guiao":
        return "Guião do professor (IVA normal 23/22/16%)"
    return "Real — taxa reduzida de Portugal (painéis 6/5/4%)"


def _net_present_value(cashflows: list[float], discount_rate: float) -> float:
    return sum(value / ((1 + discount_rate) ** year) for year, value in enumerate(cashflows))


def _estimate_irr(cashflows: list[float]) -> Optional[float]:
    if not cashflows or min(cashflows) >= 0 or max(cashflows) <= 0:
        return None

    low = -0.95
    high = 1.0
    for _ in range(80):
        mid = (low + high) / 2
        npv_mid = _net_present_value(cashflows, mid)
        if abs(npv_mid) < 0.01:
            return mid
        npv_low = _net_present_value(cashflows, low)
        if npv_low * npv_mid <= 0:
            high = mid
        else:
            low = mid
    return (low + high) / 2


def compute_fiscal_and_roi(data: FiscalInput) -> FiscalResult:
    vat_panels, vat_battery = get_vat_rates(data.region, data.scenario)

    panels_with_vat = data.panel_system_cost_eur * (1 + vat_panels)
    battery_with_vat = data.battery_cost_eur * (1 + vat_battery)
    total_cost = panels_with_vat + battery_with_vat

    effective_price = data.electricity_price_eur_kwh
    if data.has_social_tariff:
        effective_price *= (1 - SOCIAL_TARIFF_DISCOUNT)

    annual_savings = data.annual_energy_kwh * effective_price
    payback = total_cost / annual_savings if annual_savings > 0 else float("inf")
    yearly_cashflows = [
        (annual_savings * ((1 - data.annual_degradation_rate) ** year)) - data.annual_maintenance_eur
        for year in range(data.analysis_years)
    ]
    lifetime_savings = sum(yearly_cashflows)
    cashflows = [-total_cost, *yearly_cashflows]
    npv = _net_present_value(cashflows, data.discount_rate)
    irr = _estimate_irr(cashflows)

    return FiscalResult(
        scenario=data.scenario,
        scenario_label=_scenario_label(data.scenario),
        vat_panels_rate=vat_panels,
        vat_battery_rate=vat_battery,
        total_cost_with_vat=total_cost,
        effective_electricity_price_eur_kwh=effective_price,
        annual_savings_eur=annual_savings,
        payback_years=payback,
        lifetime_savings_eur=lifetime_savings,
        npv_eur=npv,
        irr_percent=irr * 100 if irr is not None else None,
    )


def compute_fiscal_both(data: FiscalInput) -> dict[str, FiscalResult]:
    """Calcula ambos os cenários de IVA (real e guião do professor).

    Devolve {"real": FiscalResult, "guiao": FiscalResult}. A poupança, payback e
    NPV diferem apenas pelo custo inicial (IVA dos painéis), já que a produção e o
    preço da eletricidade são iguais nos dois cenários.
    """
    return {
        "real": compute_fiscal_and_roi(data.model_copy(update={"scenario": "real"})),
        "guiao": compute_fiscal_and_roi(data.model_copy(update={"scenario": "guiao"})),
    }
