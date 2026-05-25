from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "APY"
    database_url: str = "sqlite:///./pulseroot.db"
    frontend_origin: str = "http://localhost:3000"
    extra_frontend_origins: str = ""
    allow_cloudflare_tunnel_origins: bool = False
    allow_vercel_origins: bool = False
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    simulator_enabled: bool = True
    simulator_tick_seconds: float = 1.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins(self) -> list[str]:
        configured_origins = [
            origin.strip().rstrip("/")
            for origin in self.extra_frontend_origins.split(",")
            if origin.strip()
        ]
        default_origins = [
            self.frontend_origin,
            "http://127.0.0.1:3000",
            "http://localhost:3001",
        ]
        return sorted({origin.rstrip("/") for origin in [*default_origins, *configured_origins]})

    @property
    def cors_origin_regex(self) -> str | None:
        patterns: list[str] = []
        if self.allow_cloudflare_tunnel_origins:
            patterns.append(r"^https://[a-zA-Z0-9-]+\.trycloudflare\.com$")
        if self.allow_vercel_origins:
            patterns.append(r"^https://[a-zA-Z0-9-]+\.vercel\.app$")
        if not patterns:
            return None
        return "|".join(f"(?:{pattern})" for pattern in patterns)


@lru_cache
def get_settings() -> Settings:
    return Settings()
