from groq import AsyncGroq
from app.core.config import settings

groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

# Modelo recomendado para análise de texto com boa qualidade:
GROQ_MODEL = "llama-3.3-70b-versatile"

# Modelo multimodal (visão) para ler faturas a partir de imagens.
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
