from pydantic import BaseModel


class AgentResponse(BaseModel):
    role: str
    content: str


class OrchestratorOutput(BaseModel):
    physics_analysis: AgentResponse
    financial_analysis: AgentResponse
    sustainability_analysis: AgentResponse
    summary: str
