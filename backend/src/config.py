"""Application configuration settings."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str

    # JWT Authentication
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # Timezone
    TIMEZONE: str = "Asia/Kolkata"

    # System Administrator password (separate from user passwords)
    SA_PASSWORD: str = "admin123"

    # AI (Claude API)
    ANTHROPIC_API_KEY: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
