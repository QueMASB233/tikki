import os
from pathlib import Path
from cryptography.fernet import Fernet
from loguru import logger
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
# Buscar .env en el directorio raíz del proyecto (tres niveles arriba desde backend/app/lib/security/)
env_path = Path(__file__).parent.parent.parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# Obtener clave de entorno o generar una temporal (inseguro para prod, pero funcional para dev)
# En producción, ESTO DEBE SER UNA VARIABLE DE ENTORNO FIJA
_key = os.getenv("ENCRYPTION_KEY")
if not _key:
    logger.warning("No ENCRYPTION_KEY found in env. Using a generated key (data will be unreadable after restart).")
    _key = Fernet.generate_key().decode()
else:
    logger.info("ENCRYPTION_KEY loaded successfully from environment.")

cipher_suite = Fernet(_key.encode())

def encrypt_message(message: str) -> str:
    """Encripta un mensaje de texto plano."""
    if not message:
        return ""
    try:
        return cipher_suite.encrypt(message.encode()).decode()
    except Exception as e:
        logger.error(f"Error encrypting message: {e}")
        return message # Fallback a texto plano si falla (o raise error)

def decrypt_message(encrypted_message: str) -> str:
    """Desencripta un mensaje encriptado."""
    if not encrypted_message:
        return ""
    try:
        # Intentar desencriptar. Si falla (ej. es texto plano antiguo), devolver original
        return cipher_suite.decrypt(encrypted_message.encode()).decode()
    except Exception:
        # Asumir que el mensaje no estaba encriptado (migración suave)
        return encrypted_message

