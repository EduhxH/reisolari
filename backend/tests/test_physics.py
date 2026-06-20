"""Tests for the area-driven physics model (E = A·r·H·PR)."""

import unittest

from app.services.physics import PhysicsInput, compute_annual_energy


class TestPhysics(unittest.TestCase):
    def test_energy_formula(self):
        res = compute_annual_energy(
            PhysicsInput(
                area_m2=10.0,
                panel_efficiency=0.20,
                irradiation_kwh_m2_year=1500.0,
                performance_ratio=0.80,
            )
        )
        # 10 × 0.20 × 1500 × 0.80 = 2400
        self.assertAlmostEqual(res.annual_energy_kwh, 2400.0, places=6)

    def test_zero_area_is_zero_energy(self):
        res = compute_annual_energy(
            PhysicsInput(area_m2=0.0, panel_efficiency=0.2, irradiation_kwh_m2_year=1500, performance_ratio=0.8)
        )
        self.assertEqual(res.annual_energy_kwh, 0.0)

    def test_monotonic_in_efficiency(self):
        base = dict(area_m2=10.0, irradiation_kwh_m2_year=1500.0, performance_ratio=0.8)
        low = compute_annual_energy(PhysicsInput(panel_efficiency=0.18, **base))
        high = compute_annual_energy(PhysicsInput(panel_efficiency=0.22, **base))
        self.assertGreater(high.annual_energy_kwh, low.annual_energy_kwh)


if __name__ == "__main__":
    unittest.main()
