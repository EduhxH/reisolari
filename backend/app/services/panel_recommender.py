from __future__ import annotations

import math

from app.schemas.panel import PanelRecommendation, PanelSpec


def recommend_panels(
    roof_area_m2: float,
    target_power_kwp: float,
    irradiation_kwh_m2_year: float,
    performance_ratio: float,
    electricity_price_eur_kwh: float,
    has_social_tariff: bool,
    catalog: list[PanelSpec],
    packing_factor: float = 0.78,
    spacing_m: float = 0.05,
    max_items: int = 3,
) -> list[PanelRecommendation]:
    if roof_area_m2 <= 0 or not catalog:
        return []

    panel_catalog = catalog
    usable_area = roof_area_m2 * packing_factor
    effective_price = electricity_price_eur_kwh * (1 - 0.338 if has_social_tariff else 1)
    recommendations: list[PanelRecommendation] = []

    for panel in panel_catalog:
        panel_width_m = panel.width_mm / 1000
        panel_height_m = panel.height_mm / 1000
        panel_area_m2 = panel_width_m * panel_height_m
        placement_area_m2 = (panel_width_m + spacing_m) * (panel_height_m + spacing_m)
        panels_fit = max(0, math.floor(usable_area / placement_area_m2))
        if panels_fit == 0:
            continue

        target_count = math.ceil((target_power_kwp * 1000) / panel.power_w) if target_power_kwp > 0 else panels_fit
        recommended_count = min(panels_fit, max(1, target_count))
        installed_power_kwp = recommended_count * panel.power_w / 1000
        used_roof_area = recommended_count * panel_area_m2
        annual_energy = (
            recommended_count
            * panel_area_m2
            * panel.efficiency
            * irradiation_kwh_m2_year
            * performance_ratio
        )
        equipment_cost = recommended_count * panel.avg_price_eur
        annual_savings = annual_energy * effective_price
        payback = equipment_cost / annual_savings if annual_savings > 0 else float("inf")
        coverage_ratio = min(1.0, used_roof_area / roof_area_m2)

        if recommended_count == panels_fit:
            rationale = "Maximizes the usable roof area for this module class."
        elif installed_power_kwp >= target_power_kwp:
            rationale = "Meets the requested installed-power target while preserving spare roof area."
        else:
            rationale = "Roof area limits this option below the requested installed-power target."

        recommendations.append(
            PanelRecommendation(
                panel=panel,
                panels_fit=panels_fit,
                recommended_count=recommended_count,
                installed_power_kwp=installed_power_kwp,
                used_roof_area_m2=used_roof_area,
                roof_coverage_ratio=coverage_ratio,
                annual_energy_kwh=annual_energy,
                estimated_equipment_cost_eur=equipment_cost,
                annual_savings_eur=annual_savings,
                simple_payback_years=payback,
                rationale=rationale,
            )
        )

    return sorted(
        recommendations,
        key=lambda item: (
            item.simple_payback_years,
            abs(item.installed_power_kwp - target_power_kwp),
            -item.annual_energy_kwh,
        ),
    )[:max_items]
