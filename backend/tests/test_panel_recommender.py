"""Tests for the area-driven panel recommender (legacy /simulation endpoint)."""

import unittest

from app.schemas.panel import PanelSpec
from app.services.panel_recommender import recommend_panels


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


def _recommend(area=40.0, target_kwp=3.0, max_items=3):
    return recommend_panels(
        roof_area_m2=area,
        target_power_kwp=target_kwp,
        irradiation_kwh_m2_year=1800.0,
        performance_ratio=0.8,
        electricity_price_eur_kwh=0.20,
        has_social_tariff=False,
        catalog=CATALOG,
        max_items=max_items,
    )


class TestPanelRecommender(unittest.TestCase):
    def test_empty_catalog_returns_empty(self):
        self.assertEqual(
            recommend_panels(40, 3.0, 1800, 0.8, 0.20, False, []), []
        )

    def test_zero_area_returns_empty(self):
        self.assertEqual(_recommend(area=0.0), [])

    def test_returns_sorted_by_payback(self):
        recs = _recommend()
        self.assertTrue(recs)
        paybacks = [r.simple_payback_years for r in recs]
        self.assertEqual(paybacks, sorted(paybacks))

    def test_respects_max_items(self):
        self.assertLessEqual(len(_recommend(max_items=2)), 2)

    def test_recommended_count_within_fit(self):
        for r in _recommend():
            self.assertLessEqual(r.recommended_count, r.panels_fit)
            self.assertGreater(r.installed_power_kwp, 0)
            self.assertGreaterEqual(r.roof_coverage_ratio, 0.0)
            self.assertLessEqual(r.roof_coverage_ratio, 1.0)

    def test_social_tariff_lengthens_payback(self):
        normal = _recommend()
        social = recommend_panels(
            roof_area_m2=40.0, target_power_kwp=3.0, irradiation_kwh_m2_year=1800.0,
            performance_ratio=0.8, electricity_price_eur_kwh=0.20, has_social_tariff=True,
            catalog=CATALOG,
        )
        # A tarifa social baixa a poupança anual ⇒ payback maior para o mesmo módulo.
        by_code = {r.panel.code: r for r in normal}
        for r in social:
            if r.panel.code in by_code:
                self.assertGreaterEqual(r.simple_payback_years, by_code[r.panel.code].simple_payback_years)


if __name__ == "__main__":
    unittest.main()
