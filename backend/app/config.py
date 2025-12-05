from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    stripe_secret_key: str
    stripe_webhook_secret: str
    deepseek_api_key: str = ""
    # jwt_secret ya no es necesario, pero lo mantenemos por compatibilidad
    jwt_secret: str = "deprecated"
    jwt_algorithm: str = "HS256"
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"
    # HighLevel API configuration (optional)
    highlevel_api_key: str = ""
    highlevel_base_url: str = "https://services.leadconnectorhq.com"
    highlevel_location_id: str = ""

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"), env_file_encoding="utf-8", extra="allow"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]




