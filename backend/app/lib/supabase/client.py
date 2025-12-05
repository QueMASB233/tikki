"""Cliente de Supabase."""

from functools import lru_cache
from supabase import Client, create_client
from loguru import logger

from ...config import Settings, get_settings


@lru_cache
def get_supabase_client() -> Client:
    """Obtiene el cliente de Supabase (singleton)."""
    settings = get_settings()
    logger.debug("Initializing Supabase client")
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return client




