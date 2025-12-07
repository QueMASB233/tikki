from typing import Optional
import os
import ssl

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from loguru import logger
from supabase import Client, create_client
from postgrest.exceptions import APIError
import httpx

# Usar certificados del sistema de macOS en lugar de certifi
# certifi no funciona correctamente en macOS con Python 3.12
_macos_cert_path = "/etc/ssl/cert.pem"
if os.path.exists(_macos_cert_path):
    os.environ["SSL_CERT_FILE"] = _macos_cert_path
    os.environ["REQUESTS_CA_BUNDLE"] = _macos_cert_path
    logger.info("Using macOS system certificates: {}", _macos_cert_path)
else:
    # Fallback: deshabilitar verificación SSL si no hay certificados del sistema
    logger.warning("macOS system certificates not found, SSL verification will be disabled")
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    # Monkey patch para deshabilitar SSL
    _original_create_ssl_context = httpx._config.create_ssl_context
    def _patched_create_ssl_context(*args, **kwargs):
        kwargs["verify"] = False
        return ssl._create_unverified_context()
    httpx._config.create_ssl_context = _patched_create_ssl_context

from .config import Settings, get_settings

security = HTTPBearer(auto_error=False)


def get_supabase(settings: Settings = Depends(get_settings)) -> Client:
    logger.debug("Initializing Supabase client")
    logger.debug("Supabase URL: {}", settings.supabase_url)
    logger.debug("Service role key present: {}", bool(settings.supabase_service_role_key))
    logger.debug("Service role key starts with: {}", settings.supabase_service_role_key[:10] if settings.supabase_service_role_key else "N/A")
    
    if not settings.supabase_service_role_key or settings.supabase_service_role_key in ["REEMPLAZA_CON_TU_SERVICE_ROLE_KEY", "your_supabase_service_role_key_here", ""]:
        logger.error("SUPABASE_SERVICE_ROLE_KEY no está configurado correctamente!")
        logger.error("Para obtenerla: https://supabase.com/dashboard/project/mgmkxwasvncvvizclewp → Settings → API → service_role key")
        # Permitir que el backend inicie pero las funciones que requieren service_role fallarán
        # Usar anon key temporalmente solo para que el cliente se cree (limitado)
        if settings.supabase_anon_key:
            logger.warning("Usando anon key temporalmente. Las funciones de admin (crear usuarios) NO funcionarán.")
            settings.supabase_service_role_key = settings.supabase_anon_key
        else:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY debe estar configurado. Obténla en: Supabase Dashboard → Settings → API")
    
    try:
        # Crear cliente de Supabase - usar configuración por defecto
        client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        logger.debug("Supabase client created successfully")
        logger.debug("Client type: {}", type(client))
        logger.debug("Client attributes: {}", [x for x in dir(client) if not x.startswith('_')])
        
        # Verificar que el cliente tiene el método table
        if not hasattr(client, 'table'):
            logger.error("Supabase client does not have 'table' method!")
            raise ValueError("Supabase client is not properly initialized")
        
        # Test: ver qué devuelve table()
        test_table = client.table("users")
        logger.debug("Test table object type: {}", type(test_table))
        logger.debug("Test table methods: {}", [x for x in dir(test_table) if not x.startswith('_')])
        
        return client
    except Exception as e:
        logger.exception("Error creating Supabase client: {}", e)
        raise


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_supabase),
):
    """Obtiene el usuario actual usando Supabase Auth."""
    logger.debug("get_current_user called, credentials: {}", credentials)
    
    if credentials is None:
        logger.warning("No credentials provided in request")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado"
        )

    token = credentials.credentials
    logger.debug("Token received (first 20 chars): {}", token[:20] if token else None)
    
    try:
        # Usar Supabase Auth para verificar el token
        auth_user = supabase.auth.get_user(token)
        
        if not auth_user or not auth_user.user:
            logger.warning("Invalid token: user not found in Supabase Auth")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
            )
        
        auth_user_id = auth_user.user.id
        logger.debug("Authenticated auth_user_id: {}", auth_user_id)
        
        # Buscar el usuario en nuestra tabla public.users usando auth_user_id
        try:
            response = supabase.table("users").select("*").eq("auth_user_id", auth_user_id).single().execute()
            
            if not hasattr(response, 'data') or not response.data:
                logger.warning("User not found in public.users for auth_user_id: {}", auth_user_id)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado. Por favor, completa tu registro."
                )
        except APIError as e:
            # Si no se encuentra el usuario (APIError con código PGRST116), significa que no existe en la tabla
            if hasattr(e, 'code') and e.code == 'PGRST116':
                logger.warning("User not found in public.users for auth_user_id: {} - User exists in Auth but not in users table", auth_user_id)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, 
                    detail="Usuario no encontrado. Por favor, completa tu registro."
                )
            # Re-lanzar otros errores de API
            raise
        except Exception as e:
            # Manejar otros errores
            logger.error("Unexpected error fetching user: {}", e)
            raise

        logger.debug("User authenticated successfully: {}", response.data.get("email"))
        return response.data
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in get_current_user: {}", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Error de autenticación"
        ) from e
