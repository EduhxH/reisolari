"""Tests for the dual-VAT fiscal engine (real vs guião do professor)."""

import unittest

from app.services.fiscal import (
    FiscalInput,
    _estimate_irr,
    _net_present_value,
    _scenario_label,
    compute_fiscal_and_roi,
    compute_fiscal_both,
    compute_fiscal_scenarios,
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

    def test_reduzido_scenario_reduced_everywhere(self):
        self.assertEqual(get_vat_rates("continent", "reduzido"), (0.06, 0.06))
        self.assertEqual(get_vat_rates("madeira", "reduzido"), (0.05, 0.05))
        self.assertEqual(get_vat_rates("azores", "reduzido"), (0.04, 0.04))


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

    def test_net_cost_and_vat_amount(self):
        res = compute_fiscal_and_roi(_input(panel_system_cost_eur=1000.0, battery_cost_eur=200.0))
        # net = painéis + bateria, sem IVA.
        self.assertAlmostEqual(res.net_cost_eur, 1200.0, places=4)
        # IVA = total - net, e total = net + IVA.
        self.assertAlmostEqual(res.vat_amount_eur, res.total_cost_with_vat - res.net_cost_eur, places=4)

    def test_four_vat_figures_ordered(self):
        # Com bateria, reduzido < real < guião; net é o menor de todos.
        data = _input(panel_system_cost_eur=1000.0, battery_cost_eur=500.0)
        sc = compute_fiscal_scenarios(data)
        net = sc["real"].net_cost_eur
        reduzido = sc["reduzido"].total_cost_with_vat
        real = sc["real"].total_cost_with_vat
        guiao = sc["guiao"].total_cost_with_vat
        self.assertLess(net, reduzido)
        self.assertLess(reduzido, real)   # bateria a 6% < bateria a 23%
        self.assertLess(real, guiao)      # painéis a 6% < painéis a 23%

    def test_scenarios_share_savings_and_net(self):
        sc = compute_fiscal_scenarios(_input(panel_system_cost_eur=1000.0, battery_cost_eur=500.0))
        savings = {r.annual_savings_eur for r in sc.values()}
        nets = {round(r.net_cost_eur, 6) for r in sc.values()}
        self.assertEqual(len(savings), 1)  # produção/poupança independentes do IVA
        self.assertEqual(len(nets), 1)     # preço sem IVA é igual nos 3 cenários

    def test_reduzido_label(self):
        self.assertIn("reduzido", _scenario_label("reduzido").lower())


class TestRoiHelpers(unittest.TestCase):
    def test_npv_no_discount_is_sum(self):
        self.assertAlmostEqual(_net_present_value([100, 100, 100], 0.0), 300.0, places=6)

    def test_npv_discounts_future(self):
        self.assertAlmostEqual(_net_present_value([0, 100], 0.10), 100 / 1.10, places=6)

    def test_irr_none_without_sign_change(self):
        self.assertIsNone(_estimate_irr([100, 100, 100]))   # nunca recupera o sinal
        self.assertIsNone(_estimate_irr([]))

    def test_irr_positive_for_profitable_project(self):
        irr = _estimate_irr([-100, 60, 60, 60])
        self.assertIsNotNone(irr)
        self.assertGreater(irr, 0)

    def test_irr_none_surfaced_when_no_savings(self):
        res = compute_fiscal_and_roi(_input(annual_energy_kwh=0.0, electricity_price_eur_kwh=0.20))
        self.assertEqual(res.payback_years, float("inf"))
        self.assertIsNone(res.irr_percent)


if __name__ == "__main__":
    unittest.main()
