from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    MONGO_URI: str = "mongodb://localhost:27017"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    # SerpAPI (Google Shopping/Web) — fonte externa de painéis para o menu "Ideais".
    SERPAPI_API_KEY: str = ""
    FRONTEND_PUBLIC_URL: str = "http://localhost:3000"
    BACKEND_PUBLIC_URL: str = "http://localhost:8000"
    FIREBASE_PROJECT_ID: str = "reisolari-92630"
    MAPBOX_TOKEN: str = ""
    # Comma-separated Firebase uids allowed into the moderation area.
    ADMIN_UIDS: str = ""

    @property
    def admin_uid_set(self) -> set[str]:
        return {uid.strip() for uid in self.ADMIN_UIDS.split(",") if uid.strip()}

    class Config:
        # Lê tanto ".env" (convenção) como "env" (ficheiro de segredos local do
        # projeto). O último tem precedência, garantindo que os segredos reais em
        # backend/env são efetivamente carregados.
        env_file = (".env", "env")
        extra = "ignore"


settings = Settings()
