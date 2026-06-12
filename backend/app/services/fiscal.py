from typing import Literal, Optional
from pydantic import BaseModel

RegionType = Literal["continent", "madeira", "azores"]


class FiscalInput(BaseModel):
    region: RegionType
    panel_system_cost_eur: float
    battery_cost_eur: float
    annual_energy_kwh: float
    electricity_price_eur_kwh: float
    has_social_tariff: bool
    analysis_years: int = 25
    discount_rate: float = 0.04
    annual_degradation_rate: float = 0.005
    annual_maintenance_eur: float = 0.0


class FiscalResult(BaseModel):
    vat_panels_rate: float
    vat_battery_rate: float
    total_cost_with_vat: float
    effective_electricity_price_eur_kwh: float
    annual_savings_eur: float
    payback_years: float
    lifetime_savings_eur: float
    npv_eur: float
    irr_percent: Optional[float]


def get_vat_rates(region: RegionType) -> tuple[float, float]:
    if region == "continent":
        return 0.06, 0.23
    if region == "madeira":
        return 0.05, 0.22
    if region == "azores":
        return 0.04, 0.16
    return 0.06, 0.23


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
    vat_panels, vat_battery = get_vat_rates(data.region)

    panels_with_vat = data.panel_system_cost_eur * (1 + vat_panels)
    battery_with_vat = data.battery_cost_eur * (1 + vat_battery)
    total_cost = panels_with_vat + battery_with_vat

    effective_price = data.electricity_price_eur_kwh
    if data.has_social_tariff:
        effective_price *= (1 - 0.338)  # 33.8% desconto

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
