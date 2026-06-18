"""Hidden LLM reasoning for the four agents (physics, finance, sustainability, analyst).

This prose is stored ONLY in the backend (Mongo) and is NEVER returned to the
frontend. The numbers the user sees come from the deterministic
``app.services.analysis`` builder. If Groq is unavailable, reasoning is returned
empty and the pipeline continues — the structured numbers are unaffected.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

from app.agents.base import BackendReasoning, StructuredAnalysis
from app.agents.groq_client import GROQ_MODEL, groq_client

logger = logging.getLogger(__name__)


async def _ask(system: str, facts: str) -> str:
    """Single grounded completion; returns '' on any failure (never raises)."""
    try:
        resp = await groq_client.chat.completions.create(
            model=GROQ_MODEL,
            temperature=0.2,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": facts},
            ],
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as exc:  # rede/quota/parse — nunca quebra o pipeline
        logger.warning("Reasoning agent failed (non-fatal): %s", exc)
        return ""


def _facts(analysis: StructuredAnalysis, context: Dict[str, Any]) -> str:
    a = analysis
    return (
        f"Região: {context.get('region')} | Consumo anual: {context.get('annual_consumption_kwh')} kWh | "
        f"Cobertura: {context.get('coverage')}\n"
        f"Solução recomendada: {a.analyst.recommended_archetype} (confiança {a.analyst.confidence}).\n"
        f"Física: eficiência {a.physics.panel_efficiency}, coef. temp {a.physics.temperature_coefficient_per_c}/°C, "
        f"temp célula {a.physics.estimated_cell_temp_c}°C, derating térmico {a.physics.thermal_derating_factor:.3f}.\n"
        f"Financeiro: payback real {a.finance.payback_years_real:.1f} anos, guião {a.finance.payback_years_guiao:.1f} anos, "
        f"NPV real {a.finance.npv_eur_real:.0f}€, IRR {a.finance.irr_percent_real}.\n"
        f"Sustentabilidade: CO2 {a.sustainability.co2_annual_kg:.0f} kg/ano, {a.sustainability.co2_lifetime_kg:.0f} kg em 25 anos."
    )


async def generate_reasoning(
    analysis: StructuredAnalysis, context: Dict[str, Any]
) -> BackendReasoning:
    """Gera a prosa dos 4 agentes em paralelo (PT-PT). Apenas para o backend."""
    facts = _facts(analysis, context)
    physics, finance, sustainability, analyst = await asyncio.gather(
        _ask(
            "És um físico-químico de energia fotovoltaica em Portugal. Explica com rigor "
            "o comportamento térmico e a eficiência. Português de Portugal, conciso.",
            facts,
        ),
        _ask(
            "És um analista financeiro/fiscal de energia solar em Portugal. Comenta payback, "
            "NPV/IRR e os dois cenários de IVA. Português de Portugal, conciso.",
            facts,
        ),
        _ask(
            "És um especialista de sustentabilidade. Comenta o impacto ambiental e o CO2 evitado. "
            "Português de Portugal, conciso.",
            facts,
        ),
        _ask(
            "És o analista responsável. Justifica porque a solução recomendada é a mais adequada "
            "a este utilizador, face ao questionário. Português de Portugal, conciso.",
            facts,
        ),
    )
    return BackendReasoning(
        physics=physics, finance=finance, sustainability=sustainability, analyst=analyst
    )
