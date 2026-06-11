from typing import Dict, Any
from app.agents.base import AgentResponse
from app.agents.groq_client import groq_client, GROQ_MODEL


async def finance_agent(payload: Dict[str, Any]) -> AgentResponse:
    prompt = f"""
    És um especialista financeiro e fiscal em energia em Portugal.
    Dados:
    - Energia anual estimada: {payload["annual_energy_kwh"]:.2f} kWh/ano
    - Poupança anual estimada: {payload["annual_savings_eur"]:.2f} €/ano
    - Payback: {payload["payback_years"]:.2f} anos
    - IVA painéis: {payload["vat_panels_rate"]*100:.1f}%
    - IVA baterias: {payload["vat_battery_rate"]*100:.1f}%
    - Tarifa Social de Energia: {"Sim" if payload["has_social_tariff"] else "Não"}
    - Preço base da eletricidade: {payload["electricity_price_eur_kwh"]:.3f} €/kWh

    Analisa:
    - Se o investimento faz sentido economicamente.
    - Como o IVA reduzido afeta o payback.
    - Impacto socioeconómico da Tarifa Social de Energia (desconto 33.8%).
    """

    resp = await groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    content = resp.choices[0].message.content
    return AgentResponse(role="finance_tax", content=content)
