"""Verifies the orçamento PDF builds from a full simulation record."""

import unittest

from app.schemas.panel import PanelSpec
from app.schemas.questionnaire import Questionnaire
from app.services.quote_pdf import build_quote_pdf
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


class TestQuotePdf(unittest.TestCase):
    def test_builds_valid_pdf(self):
        q = Questionnaire(
            consumption_kwh=3500, region="sul", available_area_m2=40,
            coverage=0.75, priority="equilibrio", electricity_price_eur_kwh=0.20,
        )
        result, analysis = run_questionnaire_simulation(q, CATALOG, pvgis_yield=1620.0)
        record = {
            "result": result.model_dump(),
            "questionnaire": q.model_dump(),
            "analysis": analysis.model_dump(),
            "reasoning": {"physics": "SECRETO", "finance": "SECRETO"},
        }
        pdf = build_quote_pdf(record)
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreater(len(pdf), 1500)
        # A prosa dos agentes NUNCA deve aparecer no PDF.
        self.assertNotIn(b"SECRETO", pdf)


if __name__ == "__main__":
    unittest.main()
