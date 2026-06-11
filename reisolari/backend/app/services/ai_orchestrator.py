from typing import Dict, Any
import asyncio
import json
from app.agents.agent_physics import physics_agent
from app.agents.agent_finance import finance_agent
from app.agents.agent_sustainability import sustainability_agent
from app.agents.base import OrchestratorOutput, AgentResponse
from app.agents.groq_client import groq_client, GROQ_MODEL


async def orchestrator(theme: str, payload: Dict[str, Any]) -> OrchestratorOutput:
    physics_task = asyncio.create_task(physics_agent(payload))
    finance_task = asyncio.create_task(finance_agent(payload))
    sustainability_task = asyncio.create_task(sustainability_agent(payload))

    physics_res, finance_res, sustainability_res = await asyncio.gather(
        physics_task, finance_task, sustainability_task
    )

    summary_prompt = {
        "role": "user",
        "content": f"""
        Tema do projeto: {theme}

        Resumo das análises:
        - Física/Química: {physics_res.content}
        - Financeira/Fiscal: {finance_res.content}
        - Sustentabilidade: {sustainability_res.content}

        Produz um resumo final integrado, em português de Portugal, focado em:
        - Coerência científica.
        - Viabilidade económica.
        - Impacto ambiental e social.

        Responde em JSON com o seguinte schema:
        {{
          "physics_analysis": {{"role": "string", "content": "string"}},
          "financial_analysis": {{"role": "string", "content": "string"}},
          "sustainability_analysis": {{"role": "string", "content": "string"}},
          "summary": "string"
        }}
        """,
    }

    resp = await groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[summary_prompt],
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    content = resp.choices[0].message.content
    json_data = json.loads(content)

    return OrchestratorOutput(
        physics_analysis=AgentResponse(**json_data["physics_analysis"]),
        financial_analysis=AgentResponse(**json_data["financial_analysis"]),
        sustainability_analysis=AgentResponse(**json_data["sustainability_analysis"]),
        summary=json_data["summary"],
    )
