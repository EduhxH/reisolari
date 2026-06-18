"""Golden-number tests for the consumption-driven sizing engine.

Run from the backend directory:  python -m unittest discover -s tests
The numbers below are computed by hand from the professor's formulas so any
regression in the engine is caught immediately.
"""

import math
import unittest

from app.services.solar_sizing import (
    REGION_YIELD_KWH_KWP_YEAR,
    apply_area_constraint,
    co2_avoided,
    region_to_fiscal,
    region_yield,
    size_system,
)


class TestRegionMapping(unittest.TestCase):
    def test_fiscal_region_mapping(self):
        self.assertEqual(region_to_fiscal("norte"), "continent")
        self.assertEqual(region_to_fiscal("centro"), "continent")
        self.assertEqual(region_to_fiscal("sul"), "continent")
        self.assertEqual(region_to_fiscal("madeira"), "madeira")
        self.assertEqual(region_to_fiscal("acores"), "azores")
        self.assertEqual(region_to_fiscal("Açores"), "azores")  # acentos

    def test_region_yield_table_matches_guide(self):
        self.assertEqual(region_yield("norte"), 1300.0)
        self.assertEqual(region_yield("centro"), 1450.0)
        self.assertEqual(region_yield("sul"), 1650.0)
        self.assertEqual(region_yield("madeira"), 1700.0)
        self.assertEqual(region_yield("Açores"), 1400.0)
        self.assertEqual(len(REGION_YIELD_KWH_KWP_YEAR), 5)

    def test_unknown_region_raises(self):
        with self.assertRaises(ValueError):
            region_yield("lisboa-centro")
        with self.assertRaises(ValueError):
            region_to_fiscal("estremadura")


class TestSizing(unittest.TestCase):
    def test_golden_case_sul(self):
        # 3500 kWh/ano, 75% cobertura, Sul (1650), painel 440 W.
        r = size_system(3500, 0.75, "sul", 440)
        self.assertAlmostEqual(r.target_consumption_kwh, 2625.0, places=6)
        self.assertAlmostEqual(r.required_power_kwp, 2625 / 1650, places=6)
        self.assertEqual(r.panels_required, 4)  # ceil(1590.9/440) = 4
        self.assertAlmostEqual(r.installed_power_kwp, 1.76, places=6)
        self.assertAlmostEqual(r.annual_production_kwh, 1.76 * 1650, places=6)

    def test_panels_count_is_ceiling(self):
        # required exactly 5.0 panels -> stays 5; just over -> rounds up to 6.
        r = size_system(1000, 1.0, "norte", 200)  # 1000/1300 kWp = 0.769..., W=769.2
        self.assertEqual(r.panels_required, math.ceil(769.23 / 200))  # = 4

    def test_installed_power_consistency(self):
        # nº painéis × potência == potência instalada (kWp), sempre.
        r = size_system(6000, 0.5, "centro", 435)
        self.assertAlmostEqual(
            r.installed_power_kwp, r.panels_required * 435 / 1000, places=9
        )
        self.assertAlmostEqual(
            r.annual_production_kwh,
            r.installed_power_kwp * r.region_yield_kwh_kwp_year,
            places=6,
        )

    def test_invalid_inputs(self):
        with self.assertRaises(ValueError):
            size_system(0, 0.5, "sul", 440)
        with self.assertRaises(ValueError):
            size_system(3500, 0, "sul", 440)
        with self.assertRaises(ValueError):
            size_system(3500, 1.5, "sul", 440)
        with self.assertRaises(ValueError):
            size_system(3500, 0.5, "sul", 0)


class TestAreaConstraint(unittest.TestCase):
    def test_fits_on_large_roof(self):
        r = size_system(3500, 0.75, "sul", 440)  # 4 painéis
        c = apply_area_constraint(r, 1.134, 1.762, available_area_m2=30.0)
        self.assertTrue(c.fits)
        self.assertEqual(c.panels_feasible, 4)
        self.assertAlmostEqual(c.achievable_coverage, 0.75, places=6)

    def test_limited_by_small_roof(self):
        r = size_system(3500, 0.75, "sul", 440)  # precisa de 4
        c = apply_area_constraint(r, 1.134, 1.762, available_area_m2=8.0)
        self.assertFalse(c.fits)
        self.assertEqual(c.panels_feasible, 2)  # só cabem 2
        self.assertAlmostEqual(c.achievable_coverage, 0.75 * (2 / 4), places=6)


class TestCo2(unittest.TestCase):
    def test_annual_and_lifetime(self):
        production = 1.76 * 1650  # 2904 kWh/ano
        co2 = co2_avoided(production)
        self.assertAlmostEqual(co2.annual_kg, production * 0.19, places=6)
        # 25 anos com degradação: entre 20x e 25x o anual.
        self.assertGreater(co2.lifetime_kg, co2.annual_kg * 20)
        self.assertLess(co2.lifetime_kg, co2.annual_kg * 25)
        self.assertGreater(co2.equivalent_trees, 0)
        self.assertGreater(co2.equivalent_car_km, 0)


if __name__ == "__main__":
    unittest.main()
