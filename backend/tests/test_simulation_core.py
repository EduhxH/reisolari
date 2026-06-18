"""End-to-end (pure) test of the questionnaire simulation assembly."""

import unittest

from app.schemas.panel import PanelSpec
from app.schemas.questionnaire import Questionnaire
from app.services.simulation_core import run_questionnaire_simulation


def _panel(code, power_w, w, h, eff, price) -> PanelSpec:
    return PanelSpec(
        code=code, name=code, power_w=power_w, width_mm=w, height_mm=h,
        efficiency=eff, avg_price_eur=price, category="test", source_note="test",
    )


CATALOG = [
    _panel("cheap", 410, 1096, 1754, 0.2133, 85.0),
    _panel("mid", 440, 1134, 1762, 0.2253, 105.0),
    _panel("prem", 440, 1032, 1872, 0.2280, 235.0),
]


class TestRunSimulation(unittest.TestCase):
    def test_full_assembly(self):
        q = Questionnaire(
            consumption_period="anual",
            consumption_kwh=3500,
            region="sul",
            available_area_m2=40,
            coverage=0.75,
            priority="custo",
            electricity_price_eur_kwh=0.20,
        )
        result, analysis = run_questionnaire_simulation(q, CATALOG, pvgis_yield=1620.0)

        self.assertEqual(result.region, "sul")
        self.assertEqual(result.region_yield_kwh_kwp_year, 1650.0)
        self.assertEqual(result.pvgis_yield_kwh_kwp_year, 1620.0)
        self.assertEqual(len(result.solutions), 3)
        self.assertEqual(result.recommended_archetype, "economica")  # priority custo
        # As 3 fórmulas estão presentes e por ordem.
        self.assertEqual(len(result.formula_steps), 3)
        self.assertEqual(result.formula_steps[0]["unit"], "kWh/ano")
        self.assertEqual(result.formula_steps[2]["unit"], "painéis")
        # Análise estruturada coerente.
        self.assertEqual(analysis.analyst.recommended_archetype, "economica")
        self.assertGreater(result.analysis["sustainability"]["co2_annual_kg"], 0)

    def test_monthly_consumption_is_annualised(self):
        q = Questionnaire(consumption_period="mensal", consumption_kwh=300, region="centro")
        self.assertEqual(q.annual_consumption_kwh, 3600)
        result, _ = run_questionnaire_simulation(q, CATALOG)
        self.assertEqual(result.annual_consumption_kwh, 3600)

    def test_empty_catalog_raises(self):
        q = Questionnaire(consumption_kwh=3500, region="sul")
        with self.assertRaises(ValueError):
            run_questionnaire_simulation(q, [])

    def test_invalid_coverage_rejected(self):
        with self.assertRaises(ValueError):
            Questionnaire(consumption_kwh=3500, region="sul", coverage=0.6)


if __name__ == "__main__":
    unittest.main()
