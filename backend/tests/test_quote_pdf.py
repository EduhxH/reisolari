"""Verifies the orçamento PDF builds from a full simulation record."""

import unittest

from app.schemas.panel import PanelSpec
from app.schemas.questionnaire import Questionnaire
from app.services.quote_pdf import build_quote_pdf, _quote_meta
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


def _record(**q_overrides):
    q = Questionnaire(
        consumption_kwh=3500, region="sul", available_area_m2=40,
        coverage=0.75, priority="equilibrio", electricity_price_eur_kwh=0.20,
        **q_overrides,
    )
    result, analysis = run_questionnaire_simulation(q, CATALOG, pvgis_yield=1620.0)
    return {
        "uid": "user-abc",
        "result": result.model_dump(),
        "questionnaire": q.model_dump(),
        "analysis": analysis.model_dump(),
        "reasoning": {"physics": "SECRETO", "finance": "SECRETO"},
    }


class TestQuotePdf(unittest.TestCase):
    def test_builds_valid_pdf(self):
        pdf = build_quote_pdf(_record())
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreater(len(pdf), 1500)
        # A prosa dos agentes NUNCA deve aparecer no PDF.
        self.assertNotIn(b"SECRETO", pdf)

    def test_builds_with_battery_and_budget(self):
        rec = _record(wants_battery=True, battery_cost_eur=2500, budget_eur=100000)
        # Com bateria, reduzido < real (bateria a 6% vs taxa normal).
        for s in rec["result"]["solutions"]:
            self.assertLess(
                s["fiscal_reduzido"]["total_cost_with_vat"],
                s["fiscal_guiao"]["total_cost_with_vat"],
            )
        pdf = build_quote_pdf(rec)
        self.assertTrue(pdf.startswith(b"%PDF"))

    def test_builds_with_panel_photo(self):
        from pathlib import Path
        logo = Path(__file__).resolve().parents[1] / "app" / "assets" / "reisolari-logo.jpeg"
        rec = _record()
        plain = build_quote_pdf(rec)
        rec["panel_image_bytes"] = logo.read_bytes()
        with_photo = build_quote_pdf(rec)
        self.assertTrue(with_photo.startswith(b"%PDF"))
        # A foto embebida torna o PDF maior.
        self.assertGreater(len(with_photo), len(plain))

    def test_quote_number_is_deterministic_and_unique(self):
        rec = _record()
        n1, _ = _quote_meta(rec)
        n2, _ = _quote_meta(rec)
        self.assertEqual(n1, n2)  # estável para o mesmo utilizador
        other = dict(rec, uid="someone-else")
        n3, _ = _quote_meta(other)
        self.assertNotEqual(n1, n3)
        self.assertTrue(n1.startswith("RSL-"))


if __name__ == "__main__":
    unittest.main()
