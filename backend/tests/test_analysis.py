"""Tests for the deterministic structured analysis and archetype selection."""

import unittest

from app.schemas.panel import PanelSpec
from app.services.analysis import build_structured_analysis, select_recommended_archetype
from app.services.solutions import build_solutions


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


def _solutions(area=40.0):
    return build_solutions(
        CATALOG, annual_consumption_kwh=3500, coverage=0.75, region="sul",
        available_area_m2=area, electricity_price_eur_kwh=0.20,
    )


class TestArchetypeSelection(unittest.TestCase):
    def test_priority_maps_to_archetype(self):
        sols = _solutions()
        self.assertEqual(select_recommended_archetype(sols, "custo")[0], "economica")
        self.assertEqual(select_recommended_archetype(sols, "eficiencia")[0], "premium")
        self.assertEqual(select_recommended_archetype(sols, "equilibrio")[0], "equilibrada")
        self.assertEqual(select_recommended_archetype(sols, None)[0], "equilibrada")

    def test_confidence_high_when_fits(self):
        _, confidence, fits = select_recommended_archetype(_solutions(), "custo")
        self.assertTrue(fits)
        self.assertGreaterEqual(confidence, 0.9)

    def test_empty_solutions(self):
        archetype, confidence, fits = select_recommended_archetype([], "custo")
        self.assertEqual(confidence, 0.0)
        self.assertFalse(fits)


class TestStructuredAnalysis(unittest.TestCase):
    def test_numbers_reflect_recommended(self):
        sols = _solutions()
        analysis = build_structured_analysis(sols, region_fiscal="continent", priority="custo")
        self.assertEqual(analysis.analyst.recommended_archetype, "economica")
        self.assertTrue(analysis.physics.consistency_ok)
        self.assertLess(analysis.physics.thermal_derating_factor, 1.0)
        self.assertGreater(analysis.finance.total_cost_guiao_eur, analysis.finance.total_cost_real_eur)
        self.assertGreater(analysis.sustainability.co2_annual_kg, 0)
        self.assertGreater(analysis.sustainability.equivalent_trees, 0)


if __name__ == "__main__":
    unittest.main()
