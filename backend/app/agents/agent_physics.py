from typing import Dict, Any
from app.agents.base import AgentResponse
from app.agents.groq_client import groq_client, GROQ_MODEL


async def physics_agent(payload: Dict[str, Any]) -> AgentResponse:
    prompt = f"""
    És um físico-químico especializado em energia fotovoltaica em Portugal.
    Dados:
    - Irradiação anual global (H): {payload["irradiation_kwh_m2_year"]} kWh/m²/ano
    - Área do telhado (A): {payload["area_m2"]} m²
    - Energia anual estimada (E): {payload["annual_energy_kwh"]} kWh/ano
    - Região: {payload["region"]}

    Explica, com rigor científico:
    - Comportamento térmico dos painéis na região.
    - Impacto da temperatura na perda de rendimento.
    - Eficiência de conversão da célula fotovoltaica (20.5%) e como a temperatura a afeta.
    Usa linguagem clara, mas tecnicamente correta, em português de Portugal.
    """

    resp = await groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    content = resp.choices[0].message.content
    return AgentResponse(role="physics_chemist", content=content)
