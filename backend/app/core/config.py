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
    FRONTEND_PUBLIC_URL: str = "http://localhost:3000"
    BACKEND_PUBLIC_URL: str = "http://localhost:8000"
    FIREBASE_PROJECT_ID: str = "reisolari-92630"
    MAPBOX_TOKEN: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
