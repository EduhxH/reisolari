from fastapi import APIRouter, HTTPException
from app.schemas.simulation import SimulationRequest, SimulationResponse
from app.services.pvgis import fetch_pvgis_irradiation
from app.services.physics import compute_annual_energy, PhysicsInput
from app.services.fiscal import compute_fiscal_and_roi, FiscalInput
from app.services.ai_orchestrator import orchestrator
from app.services.panel_recommender import recommend_panels
from app.services.catalog import get_panel_specs_from_products
from app.db.mongo import get_db_client

router = APIRouter()


@router.post("/", response_model=SimulationResponse)
async def run_simulation(payload: SimulationRequest):
    pvgis_res = await fetch_pvgis_irradiation(
        payload.latitude,
        payload.longitude,
        angle=payload.tilt_degrees,
        aspect=payload.aspect_degrees,
    )
    if pvgis_res is None:
        raise HTTPException(status_code=502, detail="PVGIS service unavailable")

    # PVGIS E_y é kWh/kWp/ano. Para obter H (kWh/m²/ano), assumimos:
    # E_y ≈ H * r * PR  => H ≈ E_y / (r * PR)
    H = pvgis_res.E_y / (payload.panel_efficiency * payload.performance_ratio)

    physics_input = PhysicsInput(
        area_m2=payload.area_m2,
        panel_efficiency=payload.panel_efficiency,
        irradiation_kwh_m2_year=H,
        performance_ratio=payload.performance_ratio,
    )
    physics_res = compute_annual_energy(physics_input)

    fiscal_input = FiscalInput(
        region=payload.region_type,
        panel_system_cost_eur=payload.installed_power_kwp * payload.cost_per_kwp_eur,
        battery_cost_eur=payload.battery_cost_eur,
        annual_energy_kwh=physics_res.annual_energy_kwh,
        electricity_price_eur_kwh=payload.electricity_price_eur_kwh,
        has_social_tariff=payload.has_social_tariff,
    )
    fiscal_res = compute_fiscal_and_roi(fiscal_input)
    panel_catalog = await get_panel_specs_from_products()
    recommendations = recommend_panels(
        roof_area_m2=payload.area_m2,
        target_power_kwp=payload.installed_power_kwp,
        irradiation_kwh_m2_year=H,
        performance_ratio=payload.performance_ratio,
        electricity_price_eur_kwh=payload.electricity_price_eur_kwh,
        has_social_tariff=payload.has_social_tariff,
        catalog=panel_catalog,
    )

    orchestrator_payload = {
        "irradiation_kwh_m2_year": H,
        "pvgis_specific_yield_kwh_kwp_year": pvgis_res.E_y,
        "area_m2": payload.area_m2,
        "annual_energy_kwh": physics_res.annual_energy_kwh,
        "region": payload.region_type,
        "annual_savings_eur": fiscal_res.annual_savings_eur,
        "payback_years": fiscal_res.payback_years,
        "npv_eur": fiscal_res.npv_eur,
        "irr_percent": fiscal_res.irr_percent,
        "vat_panels_rate": fiscal_res.vat_panels_rate,
        "vat_battery_rate": fiscal_res.vat_battery_rate,
        "has_social_tariff": payload.has_social_tariff,
        "electricity_price_eur_kwh": payload.electricity_price_eur_kwh,
        "tilt_degrees": payload.tilt_degrees,
        "aspect_degrees": payload.aspect_degrees,
        "top_panel_recommendation": recommendations[0].model_dump() if recommendations else None,
    }

    orchestrator_output = await orchestrator(payload.theme, orchestrator_payload)

    client = get_db_client()
    db = client.solar_p2p
    await db.simulations.insert_one(
        {
            "input": payload.model_dump(),
            "physics": physics_res.model_dump(),
            "fiscal": fiscal_res.model_dump(),
            "recommendations": [item.model_dump() for item in recommendations],
            "orchestrator_output": orchestrator_output.model_dump(),
        }
    )

    return SimulationResponse(
        annual_energy_kwh=physics_res.annual_energy_kwh,
        fiscal=fiscal_res.model_dump(),
        recommendations=recommendations,
        orchestrator_output=orchestrator_output.model_dump(),
    )
