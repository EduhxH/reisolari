"""Per-user persistence for the questionnaire and its simulation results.

Two collections keyed by Firebase uid:
  - user_questionnaires    : the latest answers (editable in Definições).
  - questionnaire_results  : the full simulation result. The agent PROSE
    (``reasoning``) is stored here for the backend only and is stripped before
    anything is returned to the frontend.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from app.agents.base import BackendReasoning, StructuredAnalysis
from app.db.mongo import get_db_client
from app.schemas.questionnaire import IdealPanel, Questionnaire, QuestionnaireResult


def _db():
    return get_db_client().solar_p2p


async def save_questionnaire(uid: str, questionnaire: Questionnaire) -> None:
    await _db().user_questionnaires.update_one(
        {"uid": uid},
        {"$set": {"questionnaire": questionnaire.model_dump(), "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


async def get_questionnaire(uid: str) -> Optional[Questionnaire]:
    doc = await _db().user_questionnaires.find_one({"uid": uid})
    if not doc or "questionnaire" not in doc:
        return None
    return Questionnaire(**doc["questionnaire"])


async def has_completed(uid: str) -> bool:
    """Completou = já correu pelo menos uma simulação."""
    return await _db().questionnaire_results.find_one({"uid": uid}, {"_id": 1}) is not None


async def save_result(
    uid: str,
    *,
    questionnaire: Questionnaire,
    result: QuestionnaireResult,
    analysis: StructuredAnalysis,
    reasoning: BackendReasoning,
    ideal_panels: list[IdealPanel],
) -> str:
    now = datetime.now(timezone.utc)
    created_iso = now.isoformat()
    stored_result = result.model_copy(update={"ideal_panels": ideal_panels, "created_at": created_iso})
    await _db().questionnaire_results.update_one(
        {"uid": uid},
        {
            "$set": {
                "uid": uid,
                "questionnaire": questionnaire.model_dump(),
                # Resultado seguro para o frontend (só números).
                "result": stored_result.model_dump(),
                # Análise estruturada + PROSA dos agentes — só backend.
                "analysis": analysis.model_dump(),
                "reasoning": reasoning.model_dump(),
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return created_iso


async def get_latest_result(uid: str) -> Optional[dict[str, Any]]:
    """Devolve o resultado seguro para o frontend (sem prosa dos agentes)."""
    doc = await _db().questionnaire_results.find_one({"uid": uid})
    if not doc:
        return None
    return doc.get("result")


async def get_full_record(uid: str) -> Optional[dict[str, Any]]:
    """Registo completo (inclui prosa) — uso interno/backend, p.ex. para o PDF."""
    return await _db().questionnaire_results.find_one({"uid": uid})
