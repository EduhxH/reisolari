"""Live end-to-end check of the questionnaire simulation pipeline.

Runs the full real flow against the configured services (Atlas, PVGIS, Groq,
SerpAPI/OLX) WITHOUT the HTTP/auth layer, by calling the same internal functions
the API uses. Persists under a throwaway uid and cleans up afterwards.

    python e2e_questionnaire.py
"""

import asyncio
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")  # consola Windows (cp1252) -> utf-8
except Exception:
    pass

from app.agents.reasoning import generate_reasoning
from app.db.mongo import get_db_client
from app.schemas.questionnaire import Questionnaire
from app.services.catalog import get_panel_specs_from_products, seed_catalog
from app.services.panel_sourcing import source_ideal_panels
from app.services.pvgis import fetch_pvgis_irradiation
from app.services.questionnaire_store import (
    get_full_record,
    get_latest_result,
    save_result,
)
from app.services.quote_pdf import build_quote_pdf
from app.services.simulation_core import run_questionnaire_simulation

TEST_UID = "e2e-questionnaire-test-uid"


async def main() -> None:
    print("1) Seeding/loading real catalog from Atlas…")
    await seed_catalog()
    catalog = await get_panel_specs_from_products()
    assert catalog, "Catálogo vazio — Atlas não tem produtos."
    print(f"   catalog: {len(catalog)} painéis reais")

    q = Questionnaire(
        consumption_period="anual",
        consumption_kwh=4200,
        region="centro",
        usage_type="habitacao",
        available_area_m2=35,
        latitude=40.2033,
        longitude=-8.4103,  # Coimbra
        coverage=0.75,
        priority="equilibrio",
        electricity_price_eur_kwh=0.20,
    )

    print("2) PVGIS (localização real)…")
    pvgis = await fetch_pvgis_irradiation(q.latitude, q.longitude, angle=q.tilt_degrees, aspect=q.aspect_degrees)
    pvgis_yield = pvgis.E_y if pvgis else None
    print(f"   PVGIS E_y: {pvgis_yield}")

    print("3) Dimensionamento + 3 soluções + análise…")
    result, analysis = run_questionnaire_simulation(q, catalog, pvgis_yield)
    assert len(result.solutions) == 3
    print(f"   recomendado: {result.recommended_archetype}")
    for s in result.solutions:
        print(
            f"   - {s.archetype}: {s.panels_feasible} painéis, {s.installed_power_kwp:.2f} kWp, "
            f"{s.annual_production_kwh:.0f} kWh/ano, custo real {s.fiscal_real['total_cost_with_vat']:.0f}€ "
            f"vs guião {s.fiscal_guiao['total_cost_with_vat']:.0f}€"
        )

    print("4) Reasoning (Groq, escondido) + sourcing (SerpAPI/OLX/P2P)…")
    rec = next(s for s in result.solutions if s.archetype == result.recommended_archetype)
    reasoning, ideal = await asyncio.gather(
        generate_reasoning(
            analysis,
            {"region": q.region, "annual_consumption_kwh": q.annual_consumption_kwh, "coverage": q.coverage},
        ),
        source_ideal_panels(
            target_power_w=rec.panel.power_w,
            target_power_kwp=rec.installed_power_kwp,
            latitude=q.latitude,
            longitude=q.longitude,
            budget_per_panel=rec.panel.avg_price_eur,
        ),
    )
    print(f"   painéis reais encontrados: {len(ideal)}")
    for p in ideal[:6]:
        print(f"   - [{p.source}] {p.title[:50]!r} | {p.price_display} | {p.power_w}W")

    try:
        print("5) Persistência (Atlas) + leitura segura para o frontend…")
        await save_result(TEST_UID, questionnaire=q, result=result, analysis=analysis, reasoning=reasoning, ideal_panels=ideal)
        frontend_safe = await get_latest_result(TEST_UID)
        assert frontend_safe is not None
        assert "reasoning" not in frontend_safe, "PROSA nao pode chegar ao frontend!"
        assert len(frontend_safe["solutions"]) == 3
        print("   resultado seguro guardado (sem prosa) OK")

        print("6) Orçamento PDF a partir do registo completo…")
        record = await get_full_record(TEST_UID)
        pdf = build_quote_pdf(record)
        assert pdf.startswith(b"%PDF")
        print(f"   PDF gerado: {len(pdf)} bytes OK")
    finally:
        print("7) Limpeza…")
        db = get_db_client().solar_p2p
        await db.questionnaire_results.delete_one({"uid": TEST_UID})
        await db.user_questionnaires.delete_one({"uid": TEST_UID})
        print("   docs de teste removidos OK")

    print("\n[OK] E2E questionario validado de ponta a ponta.")


if __name__ == "__main__":
    asyncio.run(main())
