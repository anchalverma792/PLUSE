from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PulseRoot AI"
    database_url: str = "sqlite:///./pulseroot.db"
    frontend_origin: str = "http://localhost:3000"
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    simulator_enabled: bool = True
    simulator_tick_seconds: float = 1.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
