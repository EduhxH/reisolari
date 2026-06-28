"""Testes rigorosos da validação de realismo do questionário (Reisolari).

São exercitadas duas camadas:

* as funções puras ``hard_limit_error`` / ``soft_warnings`` (a fonte única de
  verdade, também espelhada no frontend), e
* o schema Pydantic ``Questionnaire``, que tem de recusar todos os payloads
  impossíveis com ``ValidationError`` e deixar passar os valores possíveis mas
  fora do normal (esses são apenas *avisados*, nunca bloqueados).

A correr a partir da pasta backend:  python -m unittest discover -s tests
"""

import unittest

from pydantic import ValidationError

from app.schemas.questionnaire import Questionnaire
from app.services.questionnaire_validation import (
    AREA_HARD_MAX,
    BATTERY_HARD_MAX,
    BUDGET_HARD_MAX,
    CONSUMPTION_ANNUAL_HARD_MAX,
    CONSUMPTION_ANNUAL_SOFT_HIGH_HOME,
    PRICE_HARD_MAX,
    annual_equivalent,
    hard_limit_error,
    soft_warnings,
)

# Uma casa portuguesa banal — a base que cada teste altera.
VALID = dict(
    consumption_kwh=3500,
    consumption_period="anual",
    available_area_m2=30.0,
    electricity_price_eur_kwh=0.20,
    wants_battery=False,
    battery_cost_eur=0.0,
    usage_type="habitacao",
    budget_eur=None,
)


def _fields(warnings):
    return sorted(w.field for w in warnings)


class TestAnnualEquivalent(unittest.TestCase):
    def test_monthly_is_times_twelve(self):
        self.assertEqual(annual_equivalent(300, "mensal"), 3600)

    def test_annual_is_identity(self):
        self.assertEqual(annual_equivalent(3500, "anual"), 3500)


class TestHardLimitsPass(unittest.TestCase):
    def test_baseline_is_accepted(self):
        self.assertIsNone(hard_limit_error(**VALID))

    def test_borderline_values_are_not_hard_errors(self):
        self.assertIsNone(
            hard_limit_error(**{**VALID, "consumption_kwh": 7000, "consumption_period": "mensal"})
        )

    def test_ceilings_are_inclusive(self):
        self.assertIsNone(hard_limit_error(**{**VALID, "consumption_kwh": CONSUMPTION_ANNUAL_HARD_MAX}))
        self.assertIsNone(hard_limit_error(**{**VALID, "available_area_m2": AREA_HARD_MAX}))
        self.assertIsNone(hard_limit_error(**{**VALID, "electricity_price_eur_kwh": PRICE_HARD_MAX}))


class TestHardLimitsReject(unittest.TestCase):
    def test_consumption_must_be_positive(self):
        self.assertIsNotNone(hard_limit_error(**{**VALID, "consumption_kwh": 0}))
        self.assertIsNotNone(hard_limit_error(**{**VALID, "consumption_kwh": -10}))
        self.assertIsNotNone(hard_limit_error(**{**VALID, "consumption_kwh": float("nan")}))

    def test_consumption_above_ceiling(self):
        self.assertIsNotNone(
            hard_limit_error(**{**VALID, "consumption_kwh": CONSUMPTION_ANNUAL_HARD_MAX + 1})
        )
        self.assertIsNotNone(
            hard_limit_error(**{**VALID, "consumption_kwh": 100_000, "consumption_period": "mensal"})
        )

    def test_area_sign_and_ceiling(self):
        self.assertIsNotNone(hard_limit_error(**{**VALID, "available_area_m2": -1}))
        self.assertIsNotNone(hard_limit_error(**{**VALID, "available_area_m2": AREA_HARD_MAX + 1}))

    def test_price_sign_and_ceiling(self):
        self.assertIsNotNone(hard_limit_error(**{**VALID, "electricity_price_eur_kwh": -0.1}))
        self.assertIsNotNone(hard_limit_error(**{**VALID, "electricity_price_eur_kwh": PRICE_HARD_MAX + 1}))

    def test_battery_only_checked_when_wanted(self):
        self.assertIsNone(
            hard_limit_error(**{**VALID, "wants_battery": False, "battery_cost_eur": BATTERY_HARD_MAX + 1})
        )
        self.assertIsNotNone(
            hard_limit_error(**{**VALID, "wants_battery": True, "battery_cost_eur": BATTERY_HARD_MAX + 1})
        )
        self.assertIsNotNone(
            hard_limit_error(**{**VALID, "wants_battery": True, "battery_cost_eur": -5})
        )

    def test_budget_sign_and_ceiling(self):
        self.assertIsNotNone(hard_limit_error(**{**VALID, "budget_eur": -1}))
        self.assertIsNotNone(hard_limit_error(**{**VALID, "budget_eur": BUDGET_HARD_MAX + 1}))
        self.assertIsNone(hard_limit_error(**{**VALID, "budget_eur": None}))


class TestSoftWarnings(unittest.TestCase):
    def test_baseline_has_no_warnings(self):
        self.assertEqual(soft_warnings(**VALID), [])

    def test_seven_thousand_kwh_per_month_is_flagged(self):
        ws = soft_warnings(**{**VALID, "consumption_kwh": 7000, "consumption_period": "mensal"})
        self.assertEqual(_fields(ws), ["consumption_kwh"])
        self.assertIn("84 000", ws[0].message)
        self.assertIn("certeza", ws[0].message.lower())

    def test_consumption_low_is_flagged(self):
        ws = soft_warnings(**{**VALID, "consumption_kwh": 200})
        self.assertEqual(_fields(ws), ["consumption_kwh"])

    def test_threshold_is_strict(self):
        self.assertEqual(soft_warnings(**{**VALID, "consumption_kwh": CONSUMPTION_ANNUAL_SOFT_HIGH_HOME}), [])
        self.assertTrue(soft_warnings(**{**VALID, "consumption_kwh": CONSUMPTION_ANNUAL_SOFT_HIGH_HOME + 1}))

    def test_usage_type_raises_the_bar_for_business(self):
        home = soft_warnings(**{**VALID, "consumption_kwh": 20_000, "usage_type": "habitacao"})
        biz = soft_warnings(**{**VALID, "consumption_kwh": 20_000, "usage_type": "empresa"})
        self.assertEqual(_fields(home), ["consumption_kwh"])
        self.assertEqual(biz, [])

    def test_area_warnings(self):
        too_big = soft_warnings(**{**VALID, "available_area_m2": 800})
        self.assertEqual(_fields(too_big), ["available_area_m2"])
        too_small = soft_warnings(**{**VALID, "available_area_m2": 1.0})
        self.assertEqual(_fields(too_small), ["available_area_m2"])
        self.assertEqual(soft_warnings(**{**VALID, "available_area_m2": 0.0}), [])

    def test_price_warnings(self):
        high = soft_warnings(**{**VALID, "electricity_price_eur_kwh": 0.9})
        self.assertEqual(_fields(high), ["electricity_price_eur_kwh"])
        low = soft_warnings(**{**VALID, "electricity_price_eur_kwh": 0.01})
        self.assertEqual(_fields(low), ["electricity_price_eur_kwh"])

    def test_battery_warning_only_when_wanted(self):
        self.assertEqual(soft_warnings(**{**VALID, "wants_battery": False, "battery_cost_eur": 99_000}), [])
        ws = soft_warnings(**{**VALID, "wants_battery": True, "battery_cost_eur": 99_000})
        self.assertEqual(_fields(ws), ["battery_cost_eur"])

    def test_budget_warnings(self):
        low = soft_warnings(**{**VALID, "budget_eur": 200})
        self.assertEqual(_fields(low), ["budget_eur"])
        high = soft_warnings(**{**VALID, "budget_eur": 900_000})
        self.assertEqual(_fields(high), ["budget_eur"])

    def test_multiple_fields_can_warn_together(self):
        ws = soft_warnings(
            **{
                **VALID,
                "consumption_kwh": 7000,
                "consumption_period": "mensal",
                "electricity_price_eur_kwh": 0.95,
            }
        )
        self.assertEqual(_fields(ws), ["consumption_kwh", "electricity_price_eur_kwh"])


class TestSchemaIntegration(unittest.TestCase):
    def test_valid_questionnaire_constructs(self):
        q = Questionnaire(consumption_kwh=3500, region="sul", available_area_m2=30)
        self.assertEqual(q.annual_consumption_kwh, 3500)

    def test_borderline_values_still_construct(self):
        q = Questionnaire(
            consumption_kwh=7000, consumption_period="mensal", region="centro"
        )
        self.assertEqual(q.annual_consumption_kwh, 84_000)

    def test_impossible_consumption_rejected(self):
        with self.assertRaises(ValidationError):
            Questionnaire(consumption_kwh=0, region="sul")
        with self.assertRaises(ValidationError):
            Questionnaire(consumption_kwh=-5, region="sul")
        with self.assertRaises(ValidationError):
            Questionnaire(
                consumption_kwh=100_000, consumption_period="mensal", region="sul"
            )

    def test_impossible_area_rejected(self):
        with self.assertRaises(ValidationError):
            Questionnaire(consumption_kwh=3500, region="sul", available_area_m2=-10)
        with self.assertRaises(ValidationError):
            Questionnaire(
                consumption_kwh=3500, region="sul", available_area_m2=AREA_HARD_MAX + 5
            )

    def test_impossible_price_rejected(self):
        with self.assertRaises(ValidationError):
            Questionnaire(consumption_kwh=3500, region="sul", electricity_price_eur_kwh=-1)
        with self.assertRaises(ValidationError):
            Questionnaire(consumption_kwh=3500, region="sul", electricity_price_eur_kwh=50)

    def test_impossible_budget_rejected(self):
        with self.assertRaises(ValidationError):
            Questionnaire(
                consumption_kwh=3500, region="sul", budget_eur=BUDGET_HARD_MAX + 1
            )


class TestDistinctVoice(unittest.TestCase):
    """O texto tem de ler-se como Reisolari (informal 'tens'/'tua'), distinto do Easy Solar."""

    def test_hard_message_carries_brand_voice(self):
        msg = hard_limit_error(**{**VALID, "consumption_kwh": CONSUMPTION_ANNUAL_HARD_MAX + 1})
        self.assertIn("tua", msg)

    def test_soft_message_uses_informal_address(self):
        ws = soft_warnings(**{**VALID, "consumption_kwh": 7000, "consumption_period": "mensal"})
        self.assertIn("Tens a certeza", ws[0].message)


if __name__ == "__main__":
    unittest.main()
