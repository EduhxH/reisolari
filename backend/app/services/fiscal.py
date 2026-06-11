from typing import Literal
from pydantic import BaseModel

RegionType = Literal["continent", "madeira", "azores"]


class FiscalInput(BaseModel):
    region: RegionType
    panel_system_cost_eur: float
    battery_cost_eur: float
    annual_energy_kwh: float
    electricity_price_eur_kwh: float
    has_social_tariff: bool


class FiscalResult(BaseModel):
    vat_panels_rate: float
    vat_battery_rate: float
    total_cost_with_vat: float
    annual_savings_eur: float
    payback_years: float


def get_vat_rates(region: RegionType) -> tuple[float, float]:
    if region == "continent":
        return 0.06, 0.23
    if region == "madeira":
        return 0.05, 0.22
    if region == "azores":
        return 0.04, 0.16
    return 0.06, 0.23


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

    return FiscalResult(
        vat_panels_rate=vat_panels,
        vat_battery_rate=vat_battery,
        total_cost_with_vat=total_cost,
        annual_savings_eur=annual_savings,
        payback_years=payback,
    )
