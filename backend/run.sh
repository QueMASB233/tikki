#!/bin/bash

# Script para iniciar el backend con configuración SSL correcta

# Activar entorno virtual
source venv/bin/activate

# Configurar certificados SSL
export SSL_CERT_FILE="$(python -c 'import certifi; print(certifi.where())')"
export REQUESTS_CA_BUNDLE="$SSL_CERT_FILE"
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

# Verificar que el certificado existe
if [ ! -f "$SSL_CERT_FILE" ]; then
    echo "Error: Certificate file not found: $SSL_CERT_FILE"
    exit 1
fi

echo "Using SSL certificate: $SSL_CERT_FILE"
echo "Starting backend server..."

# Iniciar servidor
uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
