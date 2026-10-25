from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Windline API"
    api_prefix: str = "/api/v1"
    elexon_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1"
    request_timeout_seconds: float = 45.0
    cache_ttl_seconds: int = 900
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    demo_mode: bool = False
    allow_demo_fallback: bool = True
    decision_cutoff_default: str = "12:00"
    model_config = SettingsConfigDict(env_file=".env", env_prefix="WINDLINE_", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
