from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    STRIPE_SECRET_KEY: str
    STRIPE_WEBHOOK_SECRET: str
    MONGO_URI: str
    REDIS_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    GROQ_API_KEY: str

    class Config:
        env_file = ".env"


settings = Settings()
