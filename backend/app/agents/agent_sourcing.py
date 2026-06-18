"""LLM reranking agent for sourced solar-panel offers.

Given the deterministically-scored candidates and the user's required specs, the
agent enforces a rigorous relevance order: real PV modules matching the target
power first, accessories/irrelevant items dropped. It returns a reordered list;
any failure is raised to the caller, which falls back to the deterministic order.
"""

from __future__ import annotations

import json

from app.agents.groq_client import GROQ_MODEL, groq_client
from app.schemas.questionnaire import IdealPanel


async def rerank_panels(
    panels: list[IdealPanel],
    *,
    target_power_w: int,
    target_power_kwp: float,
) -> list[IdealPanel]:
    if len(panels) <= 1:
        return panels

    listing = [
        {
            "i": i,
            "title": p.title,
            "power_w": p.power_w,
            "price_eur": p.price_eur,
            "source": p.source,
        }
        for i, p in enumerate(panels)
    ]
    prompt = (
        "És um especialista em painéis solares. O utilizador precisa de módulos "
        f"fotovoltaicos de ~{target_power_w} W (sistema de ~{target_power_kwp:.1f} kWp). "
        "Ordena os anúncios do mais ao menos adequado às specs e REMOVE os que não são "
        "módulos fotovoltaicos reais (acessórios, cabos, lanternas, etc.). "
        "Responde só em JSON: {\"order\": [índices pela ordem recomendada]}.\n\n"
        f"Anúncios: {json.dumps(listing, ensure_ascii=False)}"
    )
    resp = await groq_client.chat.completions.create(
        model=GROQ_MODEL,
        temperature=0.0,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )
    data = json.loads(resp.choices[0].message.content or "{}")
    order = data.get("order", [])
    if not isinstance(order, list) or not order:
        return panels

    seen: set[int] = set()
    reranked: list[IdealPanel] = []
    for idx in order:
        if isinstance(idx, int) and 0 <= idx < len(panels) and idx not in seen:
            seen.add(idx)
            reranked.append(panels[idx])
    # Mantém quaisquer candidatos não mencionados, no fim, pela ordem original.
    reranked.extend(panels[i] for i in range(len(panels)) if i not in seen)
    return reranked
