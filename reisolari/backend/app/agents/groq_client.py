from groq import AsyncGroq
from app.core.config import settings

groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

# Modelo recomendado para análise de texto com boa qualidade:
GROQ_MODEL = "llama-3.3-70b-versatile"
