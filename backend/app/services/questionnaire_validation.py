"""Validação de realismo dos dados do questionário (Reisolari).

O questionário alimenta todo o motor de dimensionamento: um único número sem
sentido (uma área negativa, uma casa com 7 000 kWh/mês, uma tarifa de 10 €/kWh)
contamina em silêncio todos os cálculos seguintes. Este módulo é a fonte única
de verdade sobre o que é *impossível* e o que é apenas *fora do normal*:

* **Limites rígidos** — valores impossíveis no contexto. São recusados de
  imediato (o schema levanta erro, a API responde 422). A positividade campo a
  campo já é garantida pelas restrições ``Field`` do Pydantic; aqui juntam-se os
  tetos superiores e a verificação de sinal, para a mesma função também servir o
  frontend.
* **Avisos suaves** — valores *possíveis* mas muito fora do esperado para um
  telhado em Portugal. Nunca bloqueiam; o frontend pergunta "tens a certeza?",
  explica o porquê e sugere rever o dado.

Tudo aqui é **puro** (primitivos a entrar, primitivos a sair) — sem importar o
schema, sem BD, sem rede — logo é totalmente testável e sem ciclos de import. O
texto está propositadamente na voz Reisolari; o Easy Solar mantém um módulo
gémeo com palavras diferentes.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

# ── Limites de engenharia (iguais nos dois projetos; só o texto muda) ──
CONSUMPTION_ANNUAL_HARD_MAX = 1_000_000.0      # kWh/ano — teto absoluto
CONSUMPTION_ANNUAL_SOFT_LOW = 600.0            # ≈ 50 kWh/mês
CONSUMPTION_ANNUAL_SOFT_HIGH_HOME = 15_000.0   # habitação
CONSUMPTION_ANNUAL_SOFT_HIGH_BIZ = 150_000.0   # empresa

AREA_HARD_MAX = 100_000.0                       # m² (10 ha) — telhado irreal
AREA_SOFT_HIGH_HOME = 500.0                     # m²
AREA_SOFT_HIGH_BIZ = 5_000.0                    # m²
AREA_MIN_PANEL_M2 = 2.0                          # abaixo disto não cabe 1 painel

PRICE_HARD_MAX = 10.0                            # €/kWh — impossível
PRICE_SOFT_HIGH = 0.60                           # €/kWh
PRICE_SOFT_LOW = 0.05                            # €/kWh

BATTERY_HARD_MAX = 200_000.0                     # €
BATTERY_SOFT_HIGH = 30_000.0                     # €

BUDGET_HARD_MAX = 10_000_000.0                   # €
BUDGET_SOFT_LOW = 1_000.0                        # €
BUDGET_SOFT_HIGH = 500_000.0                     # €


@dataclass(frozen=True)
class Warning:
    """Aviso de realismo, não bloqueante, mostrado como um "tens a certeza?"."""

    field: str
    message: str


def annual_equivalent(consumption_kwh: float, consumption_period: str) -> float:
    """Passa o consumo a anual (os valores mensais são ×12)."""
    return consumption_kwh * (12 if consumption_period == "mensal" else 1)


def _fmt(value: float) -> str:
    """Inteiro compacto para as mensagens (ex.: 84000 -> '84 000')."""
    return f"{value:,.0f}".replace(",", " ")


def hard_limit_error(
    *,
    consumption_kwh: float,
    consumption_period: str = "anual",
    available_area_m2: float = 0.0,
    electricity_price_eur_kwh: float = 0.20,
    wants_battery: bool = False,
    battery_cost_eur: float = 0.0,
    usage_type: str = "habitacao",
    budget_eur: Optional[float] = None,
) -> Optional[str]:
    """Devolve a 1.ª violação de limite rígido, ou ``None`` se tudo for válido.

    Cobre sinal/finitude *e* os tetos absolutos, para a mesma verificação
    proteger a API (via schema) e ser espelhada no frontend.
    """
    # --- Consumo ---
    if consumption_kwh is None or not math.isfinite(consumption_kwh) or consumption_kwh <= 0:
        return "O consumo é obrigatório e tem de ser maior que zero."
    annual = annual_equivalent(consumption_kwh, consumption_period)
    if annual > CONSUMPTION_ANNUAL_HARD_MAX:
        return "Consumo fora do alcance do simulador. Confirma os kWh na tua fatura."

    # --- Área ---
    if available_area_m2 is None or not math.isfinite(available_area_m2) or available_area_m2 < 0:
        return "A área do telhado não pode ser um valor negativo."
    if available_area_m2 > AREA_HARD_MAX:
        return (
            "Área de telhado irreal — demasiado grande. "
            "Desenha de novo só o teu telhado no mapa."
        )

    # --- Preço ---
    if (
        electricity_price_eur_kwh is None
        or not math.isfinite(electricity_price_eur_kwh)
        or electricity_price_eur_kwh < 0
    ):
        return "O preço da eletricidade não pode ser negativo."
    if electricity_price_eur_kwh > PRICE_HARD_MAX:
        return "Preço por kWh impossível. Corrige o valor (€/kWh)."

    # --- Bateria ---
    if wants_battery:
        if battery_cost_eur is None or not math.isfinite(battery_cost_eur) or battery_cost_eur < 0:
            return "O custo da bateria não pode ser negativo."
        if battery_cost_eur > BATTERY_HARD_MAX:
            return "Custo da bateria fora do razoável. Corrige o valor."

    # --- Orçamento ---
    if budget_eur is not None:
        if not math.isfinite(budget_eur) or budget_eur < 0:
            return "O orçamento não pode ser negativo."
        if budget_eur > BUDGET_HARD_MAX:
            return "Orçamento fora do razoável. Corrige o valor."

    return None


def soft_warnings(
    *,
    consumption_kwh: float,
    consumption_period: str = "anual",
    available_area_m2: float = 0.0,
    electricity_price_eur_kwh: float = 0.20,
    wants_battery: bool = False,
    battery_cost_eur: float = 0.0,
    usage_type: str = "habitacao",
    budget_eur: Optional[float] = None,
) -> list[Warning]:
    """Avisos "tens a certeza?" para valores possíveis mas fora do normal.

    Pressupõe que os dados já passaram em :func:`hard_limit_error` (ou seja, são
    finitos e estão dentro dos tetos absolutos).
    """
    out: list[Warning] = []

    # --- Consumo ---
    annual = annual_equivalent(consumption_kwh, consumption_period)
    soft_high = (
        CONSUMPTION_ANNUAL_SOFT_HIGH_BIZ
        if usage_type == "empresa"
        else CONSUMPTION_ANNUAL_SOFT_HIGH_HOME
    )
    if 0 < annual < CONSUMPTION_ANNUAL_SOFT_LOW:
        out.append(
            Warning(
                "consumption_kwh",
                f"Indicaste {_fmt(annual)} kWh/ano — é muito pouco. Tens a certeza? "
                "Confirma se escolheste o período certo (mensal ou anual).",
            )
        )
    elif annual > soft_high:
        ref = (
            "o de uma empresa comum"
            if usage_type == "empresa"
            else "o de uma casa normal (cerca de 2 500–5 000 kWh/ano)"
        )
        out.append(
            Warning(
                "consumption_kwh",
                f"Indicaste {_fmt(annual)} kWh/ano — bem acima d{ref}. Tens a certeza? "
                "Se calhar trocaste o valor mensal pelo anual; senão, dá uma vista de olhos na fatura.",
            )
        )

    # --- Área ---
    area_high = AREA_SOFT_HIGH_BIZ if usage_type == "empresa" else AREA_SOFT_HIGH_HOME
    if 0 < available_area_m2 < AREA_MIN_PANEL_M2:
        out.append(
            Warning(
                "available_area_m2",
                f"Com {available_area_m2:.1f} m² não cabe um painel inteiro. "
                "Tens a certeza do contorno? Volta a desenhar o telhado.",
            )
        )
    elif available_area_m2 > area_high:
        out.append(
            Warning(
                "available_area_m2",
                f"{_fmt(available_area_m2)} m² é um telhado enorme. Tens a certeza? "
                "Confirma que o contorno no mapa é só o teu telhado.",
            )
        )

    # --- Preço ---
    if 0 <= electricity_price_eur_kwh < PRICE_SOFT_LOW:
        out.append(
            Warning(
                "electricity_price_eur_kwh",
                f"{electricity_price_eur_kwh:.2f} €/kWh é muito baixo. "
                "Tens a certeza? Vê o preço na fatura.",
            )
        )
    elif electricity_price_eur_kwh > PRICE_SOFT_HIGH:
        out.append(
            Warning(
                "electricity_price_eur_kwh",
                f"{electricity_price_eur_kwh:.2f} €/kWh está acima do normal em Portugal "
                "(à volta de 0,15–0,25 €/kWh). Tens a certeza? Confere a fatura.",
            )
        )

    # --- Bateria ---
    if wants_battery and battery_cost_eur > BATTERY_SOFT_HIGH:
        out.append(
            Warning(
                "battery_cost_eur",
                f"{_fmt(battery_cost_eur)} € de bateria é muito dinheiro. "
                "Tens a certeza? Revê o orçamento da bateria.",
            )
        )

    # --- Orçamento ---
    if budget_eur is not None:
        if 0 < budget_eur < BUDGET_SOFT_LOW:
            out.append(
                Warning(
                    "budget_eur",
                    f"{_fmt(budget_eur)} € dá para pouco num sistema solar completo. "
                    "Podes continuar, mas as propostas podem ultrapassar este valor.",
                )
            )
        elif budget_eur > BUDGET_SOFT_HIGH:
            out.append(
                Warning(
                    "budget_eur",
                    f"{_fmt(budget_eur)} € é um orçamento muito acima do normal para uma "
                    "casa. Tens a certeza?",
                )
            )

    return out
