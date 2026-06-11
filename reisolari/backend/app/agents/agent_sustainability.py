from typing import Dict, Any
from app.agents.base import AgentResponse
from app.agents.groq_client import groq_client, GROQ_MODEL

CO2_FACTOR_TON_PER_KWH = 0.00025  # 0.25 t/MWh = 0.00025 t/kWh


async def sustainability_agent(payload: Dict[str, Any]) -> AgentResponse:
    annual_co2_avoided_tons = payload["annual_energy_kwh"] * CO2_FACTOR_TON_PER_KWH

    prompt = f"""
    És um consultor de sustentabilidade.
    Dados:
    - Energia anual estimada: {payload["annual_energy_kwh"]:.2f} kWh/ano
    - CO2 evitado estimado: {annual_co2_avoided_tons:.3f} toneladas de CO2/ano
    - Região: {payload["region"]}

    Explica:
    - Impacto ambiental real em toneladas de CO2 evitadas.
    - Estratégia de "Janela Solar": recomendações de hábitos domésticos e deslocação de consumos
      para as horas de maior radiação na localidade.
    """

    resp = await groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    content = resp.choices[0].message.content
    return AgentResponse(role="sustainability", content=content)
