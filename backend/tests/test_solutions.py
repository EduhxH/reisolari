"""Tests for the three-proposal builder (Económica / Equilibrada / Premium)."""

import unittest

from app.schemas.panel import PanelSpec
from app.services.solutions import build_solutions


def _panel(code, power_w, w, h, eff, price) -> PanelSpec:
    return PanelSpec(
        code=code,
        name=code,
        power_w=power_w,
        width_mm=w,
        height_mm=h,
        efficiency=eff,
        avg_price_eur=price,
        category="test",
        source_note="test",
    )


CATALOG = [
    _panel("cheap", 410, 1096, 1754, 0.2133, 85.0),   # barato, menos eficiente
    _panel("mid", 440, 1134, 1762, 0.2253, 105.0),    # equilibrado
    _panel("prem", 440, 1032, 1872, 0.2280, 235.0),   # caro, mais eficiente
]


class TestBuildSolutions(unittest.TestCase):
    def setUp(self):
        self.solutions = build_solutions(
            CATALOG,
            annual_consumption_kwh=3500,
            coverage=0.75,
            region="sul",
            available_area_m2=40.0,
            electricity_price_eur_kwh=0.20,
        )

    def test_returns_three_in_order(self):
        self.assertEqual(
            [s.archetype for s in self.solutions],
            ["economica", "equilibrada", "premium"],
        )

    def test_premium_is_most_efficient(self):
        premium = self.solutions[2]
        max_eff = max(p.efficiency for p in CATALOG)
        self.assertEqual(premium.panel.efficiency, max_eff)

    def test_economica_not_more_expensive_than_premium(self):
        economica, _, premium = self.solutions
        self.assertLessEqual(
            economica.net_system_cost_eur, premium.net_system_cost_eur
        )

    def test_three_vat_scenarios_present_and_ordered(self):
        for s in self.solutions:
            self.assertIn("total_cost_with_vat", s.fiscal_reduzido)
            self.assertIn("total_cost_with_vat", s.fiscal_real)
            self.assertIn("total_cost_with_vat", s.fiscal_guiao)
            # Sem bateria, reduzido e real coincidem (painéis sempre à taxa reduzida).
            self.assertAlmostEqual(
                s.fiscal_reduzido["total_cost_with_vat"],
                s.fiscal_real["total_cost_with_vat"],
                places=4,
            )
            # Guião (IVA normal) custa mais que o real (IVA reduzido nos painéis).
            self.assertGreater(
                s.fiscal_guiao["total_cost_with_vat"],
                s.fiscal_real["total_cost_with_vat"],
            )
            # O preço sem IVA é menor que qualquer total com IVA.
            self.assertLess(s.fiscal_real["net_cost_eur"], s.fiscal_real["total_cost_with_vat"])
            self.assertGreater(s.co2_annual_kg, 0)
            self.assertGreater(s.annual_production_kwh, 0)

    def test_empty_catalog_returns_empty(self):
        self.assertEqual(
            build_solutions([], annual_consumption_kwh=3500, coverage=0.75, region="sul"),
            [],
        )

    def test_budget_filter_keeps_affordable(self):
        # Orçamento alto: todas as propostas cabem.
        sols = build_solutions(
            CATALOG, annual_consumption_kwh=3500, coverage=0.75, region="sul",
            available_area_m2=40.0, electricity_price_eur_kwh=0.20, budget_eur=100000,
        )
        self.assertEqual(len(sols), 3)
        for s in sols:
            self.assertLessEqual(s.fiscal_real["total_cost_with_vat"], 100000)

    def test_budget_too_low_raises_with_cheapest(self):
        with self.assertRaises(ValueError) as ctx:
            build_solutions(
                CATALOG, annual_consumption_kwh=3500, coverage=0.75, region="sul",
                available_area_m2=40.0, electricity_price_eur_kwh=0.20, budget_eur=50,
            )
        self.assertIn("orçamento", str(ctx.exception).lower())


if __name__ == "__main__":
    unittest.main()
