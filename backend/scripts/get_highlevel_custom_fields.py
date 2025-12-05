#!/usr/bin/env python3
"""
Script para obtener los campos personalizados disponibles en HighLevel.

Uso:
    python scripts/get_highlevel_custom_fields.py
"""

import sys
import json
from pathlib import Path

# Agregar el directorio raíz del backend al path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import get_settings
import httpx


def get_custom_fields():
    """Obtiene los campos personalizados disponibles en HighLevel."""
    
    # Cargar configuración
    settings = get_settings()
    
    print("=" * 60)
    print("🔍 Obteniendo campos personalizados de HighLevel...")
    print("=" * 60)
    
    if not settings.highlevel_api_key:
        print("❌ ERROR: HIGHLEVEL_API_KEY no está configurada en .env")
        return False
    
    if not settings.highlevel_location_id:
        print("❌ ERROR: HIGHLEVEL_LOCATION_ID no está configurada en .env")
        return False
    
    print(f"✅ API Key: {settings.highlevel_api_key[:10]}...")
    print(f"✅ Location ID: {settings.highlevel_location_id}")
    print()
    
    # Intentar diferentes endpoints para obtener campos personalizados
    endpoints_to_try = [
        f"{settings.highlevel_base_url}/customFields/",
        f"{settings.highlevel_base_url}/locations/{settings.highlevel_location_id}/customFields/",
        f"{settings.highlevel_base_url}/contacts/customFields/",
    ]
    
    headers = {
        "Authorization": f"Bearer {settings.highlevel_api_key}",
        "Content-Type": "application/json",
        "Version": "2021-07-28",
    }
    
    for url in endpoints_to_try:
        try:
            print(f"🔍 Intentando: {url}")
            with httpx.Client(timeout=10.0) as client:
                response = client.get(url, headers=headers)
                
                if response.status_code == 200:
                    result = response.json()
                    print("=" * 60)
                    print("✅ Campos personalizados encontrados:")
                    print("=" * 60)
                    print(json.dumps(result, indent=2, ensure_ascii=False))
                    return True
                elif response.status_code == 404:
                    print(f"   ❌ 404 - Endpoint no encontrado")
                else:
                    print(f"   ⚠️  Status {response.status_code}: {response.text[:200]}")
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
        print()
    
    print("=" * 60)
    print("⚠️  No se pudo obtener los campos personalizados automáticamente")
    print("=" * 60)
    print("\n💡 Alternativas:")
    print("1. Revisa la documentación de HighLevel API")
    print("2. Verifica en la interfaz de HighLevel los IDs de los campos personalizados")
    print("3. Los IDs pueden estar en formato como:")
    print("   - 'nationality' (nombre simple)")
    print("   - 'custom_field_123' (ID generado)")
    print("   - Un UUID o hash")
    print("\n💡 Para encontrar los IDs:")
    print("   - Ve a Settings → Custom Fields en HighLevel")
    print("   - O crea un contacto manualmente y revisa la respuesta de la API")
    
    return False


if __name__ == "__main__":
    print("\n🚀 Obteniendo campos personalizados de HighLevel...\n")
    success = get_custom_fields()
    print()
    sys.exit(0 if success else 1)



