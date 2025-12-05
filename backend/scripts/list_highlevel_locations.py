#!/usr/bin/env python3
"""
Script para listar las locations disponibles en HighLevel con tu token.

Uso:
    python scripts/list_highlevel_locations.py
"""

import sys
import json
from pathlib import Path

# Agregar el directorio raíz del backend al path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import get_settings
import httpx


def list_locations():
    """Lista las locations disponibles en HighLevel."""
    
    # Cargar configuración
    settings = get_settings()
    
    print("=" * 60)
    print("🔍 Listando locations disponibles en HighLevel...")
    print("=" * 60)
    
    if not settings.highlevel_api_key:
        print("❌ ERROR: HIGHLEVEL_API_KEY no está configurada en .env")
        return False
    
    print(f"✅ API Key: {settings.highlevel_api_key[:10]}...")
    print()
    
    url = f"{settings.highlevel_base_url}/locations/"
    headers = {
        "Authorization": f"Bearer {settings.highlevel_api_key}",
        "Content-Type": "application/json",
        "Version": "2021-07-28",
    }
    
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            
            print("=" * 60)
            print("✅ Locations encontradas:")
            print("=" * 60)
            
            if isinstance(result, dict) and "locations" in result:
                locations = result["locations"]
            elif isinstance(result, list):
                locations = result
            else:
                locations = [result] if result else []
            
            if not locations:
                print("⚠️  No se encontraron locations.")
                print("\nRespuesta completa:")
                print(json.dumps(result, indent=2, ensure_ascii=False))
                return False
            
            for i, location in enumerate(locations, 1):
                print(f"\n📍 Location #{i}:")
                print(f"   ID: {location.get('id', 'N/A')}")
                print(f"   Nombre: {location.get('name', 'N/A')}")
                print(f"   Dirección: {location.get('address1', 'N/A')}")
                if location.get('id') == settings.highlevel_location_id:
                    print("   ✅ Esta es la location configurada actualmente")
            
            print("\n" + "=" * 60)
            print("💡 Copia el ID de la location que quieres usar")
            print("   y actualiza HIGHLEVEL_LOCATION_ID en tu .env")
            print("=" * 60)
            
            return True
            
    except httpx.HTTPStatusError as e:
        print("=" * 60)
        print("❌ ERROR en la API de HighLevel")
        print("=" * 60)
        print(f"Status: {e.response.status_code}")
        print(f"Respuesta: {e.response.text}")
        
        if e.response.status_code == 401:
            print("\n💡 El token de API puede ser inválido o no tener permisos.")
        elif e.response.status_code == 403:
            print("\n💡 El token no tiene acceso a esta operación.")
        
        return False
        
    except Exception as e:
        print("=" * 60)
        print("❌ ERROR INESPERADO")
        print("=" * 60)
        print(f"Error: {str(e)}")
        return False


if __name__ == "__main__":
    print("\n🚀 Obteniendo locations de HighLevel...\n")
    success = list_locations()
    print()
    sys.exit(0 if success else 1)



