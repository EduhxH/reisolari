"""Tests for the dual-VAT fiscal engine (real vs guião do professor)."""

import unittest

from app.services.fiscal import (
    FiscalInput,
    compute_fiscal_and_roi,
    compute_fiscal_both,
    get_vat_rates,
)


class TestVatRates(unittest.TestCase):
    def test_real_scenario_reduced_panels(self):
        self.assertEqual(get_vat_rates("continent", "real"), (0.06, 0.23))
        self.assertEqual(get_vat_rates("madeira", "real"), (0.05, 0.22))
        self.assertEqual(get_vat_rates("azores", "real"), (0.04, 0.16))

    def test_guiao_scenario_standard_everywhere(self):
        self.assertEqual(get_vat_rates("continent", "guiao"), (0.23, 0.23))
        self.assertEqual(get_vat_rates("madeira", "guiao"), (0.22, 0.22))
        self.assertEqual(get_vat_rates("azores", "guiao"), (0.16, 0.16))


def _input(**overrides) -> FiscalInput:
    base = dict(
        region="continent",
        panel_system_cost_eur=1584.0,  # 1.76 kWp × 900 €/kWp
        battery_cost_eur=0.0,
        annual_energy_kwh=2904.0,
        electricity_price_eur_kwh=0.20,
        has_social_tariff=False,
    )
    base.update(overrides)
    return FiscalInput(**base)


class TestFiscalScenarios(unittest.TestCase):
    def test_total_cost_uses_correct_vat(self):
        real = compute_fiscal_and_roi(_input(scenario="real"))
        guiao = compute_fiscal_and_roi(_input(scenario="guiao"))
        self.assertAlmostEqual(real.total_cost_with_vat, 1584 * 1.06, places=4)
        self.assertAlmostEqual(guiao.total_cost_with_vat, 1584 * 1.23, places=4)
        # Guião custa mais (IVA normal) → payback mais longo.
        self.assertGreater(guiao.total_cost_with_vat, real.total_cost_with_vat)
        self.assertGreater(guiao.payback_years, real.payback_years)

    def test_savings_independent_of_scenario(self):
        both = compute_fiscal_both(_input())
        self.assertAlmostEqual(
            both["real"].annual_savings_eur, both["guiao"].annual_savings_eur, places=6
        )
        self.assertAlmostEqual(both["real"].annual_savings_eur, 2904 * 0.20, places=4)

    def test_social_tariff_reduces_effective_price(self):
        no_social = compute_fiscal_and_roi(_input(has_social_tariff=False))
        social = compute_fiscal_and_roi(_input(has_social_tariff=True))
        self.assertAlmostEqual(
            social.effective_electricity_price_eur_kwh, 0.20 * (1 - 0.338), places=6
        )
        self.assertLess(
            social.annual_savings_eur, no_social.annual_savings_eur
        )

    def test_both_returns_labeled_scenarios(self):
        both = compute_fiscal_both(_input())
        self.assertEqual(both["real"].scenario, "real")
        self.assertEqual(both["guiao"].scenario, "guiao")
        self.assertIn("guião", both["guiao"].scenario_label.lower())


if __name__ == "__main__":
    unittest.main()
