"""
Script de migración para usuarios existentes a Supabase Auth.

IMPORTANTE: Este script requiere que los usuarios tengan passwords en texto plano
o que se les solicite reestablecer su contraseña.

Si los usuarios ya tienen passwords hasheados, NO se pueden migrar directamente.
Opciones:
1. Solicitar a los usuarios que reestablezcan su contraseña
2. Enviar emails de invitación desde Supabase Auth
3. Si tienes acceso a passwords en texto plano (NO recomendado), usar este script

USO:
    python -m scripts.migrate_users_to_supabase_auth
"""

import os
import sys
from pathlib import Path

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from supabase import create_client
from loguru import logger
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configurados")


def migrate_users():
    """Migra usuarios existentes a Supabase Auth."""
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    # Obtener usuarios que aún no tienen auth_user_id
    response = supabase.table("users").select("*").is_("auth_user_id", "null").execute()
    
    if not response.data:
        logger.info("No hay usuarios para migrar")
        return
    
    users = response.data
    logger.info(f"Encontrados {len(users)} usuarios para migrar")
    
    migrated = 0
    failed = 0
    
    for user in users:
        email = user["email"]
        user_id = user["id"]
        
        try:
            # Verificar si el usuario ya existe en Supabase Auth
            try:
                # Intentar obtener el usuario por email
                auth_users = supabase.auth.admin.list_users()
                existing_auth_user = None
                for auth_user in auth_users.users:
                    if auth_user.email == email:
                        existing_auth_user = auth_user
                        break
                
                if existing_auth_user:
                    logger.info(f"Usuario {email} ya existe en Supabase Auth, vinculando...")
                    auth_user_id = existing_auth_user.id
                else:
                    # Crear usuario en Supabase Auth
                    # NOTA: Esto requiere que tengas la contraseña en texto plano
                    # Si no la tienes, el usuario debe reestablecer su contraseña
                    logger.warning(
                        f"Usuario {email} no existe en Supabase Auth. "
                        "No se puede migrar sin la contraseña en texto plano. "
                        "El usuario debe registrarse de nuevo o reestablecer su contraseña."
                    )
                    failed += 1
                    continue
                
            except Exception as e:
                logger.error(f"Error verificando/creando usuario en Auth para {email}: {e}")
                failed += 1
                continue
            
            # Actualizar el usuario en public.users con auth_user_id
            update_response = (
                supabase.table("users")
                .update({"auth_user_id": auth_user_id})
                .eq("id", user_id)
                .execute()
            )
            
            if update_response.data:
                logger.info(f"✓ Usuario {email} migrado exitosamente")
                migrated += 1
            else:
                logger.error(f"✗ Error actualizando usuario {email}")
                failed += 1
                
        except Exception as e:
            logger.exception(f"Error migrando usuario {email}: {e}")
            failed += 1
    
    logger.info(f"\nMigración completada:")
    logger.info(f"  ✓ Migrados: {migrated}")
    logger.info(f"  ✗ Fallidos: {failed}")
    logger.info(f"  Total: {len(users)}")


def send_password_reset_emails():
    """
    Envía emails de reestablecimiento de contraseña a usuarios que no tienen auth_user_id.
    Esto les permite crear su cuenta en Supabase Auth.
    """
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    response = supabase.table("users").select("email").is_("auth_user_id", "null").execute()
    
    if not response.data:
        logger.info("No hay usuarios para enviar emails")
        return
    
    users = response.data
    logger.info(f"Enviando emails de reestablecimiento a {len(users)} usuarios...")
    
    for user in users:
        email = user["email"]
        try:
            # Intentar obtener el usuario en Auth
            auth_users = supabase.auth.admin.list_users()
            auth_user = None
            for au in auth_users.users:
                if au.email == email:
                    auth_user = au
                    break
            
            if auth_user:
                # Generar link de reestablecimiento
                reset_link = supabase.auth.admin.generate_link({
                    "type": "recovery",
                    "email": email,
                })
                logger.info(f"Link de reestablecimiento para {email}: {reset_link.properties.action_link}")
            else:
                logger.warning(f"Usuario {email} no existe en Supabase Auth. Debe registrarse de nuevo.")
        except Exception as e:
            logger.error(f"Error procesando {email}: {e}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrar usuarios a Supabase Auth")
    parser.add_argument(
        "--send-reset-emails",
        action="store_true",
        help="Enviar emails de reestablecimiento de contraseña en lugar de migrar"
    )
    
    args = parser.parse_args()
    
    if args.send_reset_emails:
        send_password_reset_emails()
    else:
        migrate_users()



