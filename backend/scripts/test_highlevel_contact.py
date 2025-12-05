#!/usr/bin/env python3
"""
Script de prueba para crear un contacto en HighLevel API.

Uso:
    python scripts/test_highlevel_contact.py
"""

import asyncio
import sys
from pathlib import Path

# Agregar el directorio raíz del backend al path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import get_settings
from app.lib.highlevel import create_highlevel_contact
from loguru import logger


async def test_create_contact():
    """Prueba la creación de un contacto en HighLevel."""
    
    # Cargar configuración
    settings = get_settings()
    
    # Verificar configuración
    print("=" * 60)
    print("🔍 Verificando configuración de HighLevel...")
    print("=" * 60)
    
    if not settings.highlevel_api_key:
        print("❌ ERROR: HIGHLEVEL_API_KEY no está configurada en .env")
        return False
    
    if not settings.highlevel_location_id:
        print("❌ ERROR: HIGHLEVEL_LOCATION_ID no está configurada en .env")
        return False
    
    print(f"✅ API Key configurada: {settings.highlevel_api_key[:10]}...")
    print(f"✅ Base URL: {settings.highlevel_base_url}")
    print(f"✅ Location ID: {settings.highlevel_location_id}")
    print()
    
    # Crear datos de prueba con campos personalizados
    test_user_data = {
        "id": "test-user-123",
        "email": f"test-{asyncio.get_event_loop().time()}@estudiaseguro.com",
        "full_name": "Test Usuario Campos Personalizados",
        "study_type": "Máster en Ingeniería",
        "career_interest": "Ingeniería de Software",
        "nationality": "México",
    }
    
    print("=" * 60)
    print("📝 Creando contacto de prueba con campos personalizados...")
    print("=" * 60)
    print(f"Email: {test_user_data['email']}")
    print(f"Nombre: {test_user_data['full_name']}")
    print(f"Tipo de estudio: {test_user_data['study_type']}")
    print(f"Interés de carrera: {test_user_data['career_interest']}")
    print(f"Nacionalidad: {test_user_data['nationality']}")
    print()
    print("📋 Campos personalizados que se enviarán:")
    print(f"  - nationality: {test_user_data['nationality']}")
    print(f"  - study_type: {test_user_data['study_type']}")
    print(f"  - career_interest: {test_user_data['career_interest']}")
    print()
    
    # Mostrar el payload que se enviará (para debugging)
    from app.lib.highlevel.service import HighLevelService
    service = HighLevelService(settings)
    payload = service._build_contact_payload(test_user_data)
    payload["locationId"] = settings.highlevel_location_id
    print("📤 Payload completo que se enviará a HighLevel:")
    import json
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    print()
    
    try:
        # Crear contacto
        result = await create_highlevel_contact(test_user_data, settings)
        
        if result:
            print("=" * 60)
            print("✅ ¡CONTACTO CREADO EXITOSAMENTE!")
            print("=" * 60)
            print("\n📋 Respuesta de HighLevel API:")
            print("-" * 60)
            
            # Mostrar información relevante de la respuesta
            if isinstance(result, dict):
                # Mostrar campos comunes de la respuesta
                contact_data = result.get("contact", result) if "contact" in result else result
                
                print(f"ID del contacto: {contact_data.get('id', 'N/A')}")
                print(f"Email: {contact_data.get('email', 'N/A')}")
                print(f"Nombre: {contact_data.get('firstName', 'N/A')} {contact_data.get('lastName', 'N/A')}")
                
                # Mostrar campos personalizados si están en la respuesta
                custom_fields = contact_data.get('customFields', [])
                if custom_fields and isinstance(custom_fields, list) and len(custom_fields) > 0:
                    print("\n📋 Campos personalizados en la respuesta:")
                    for field in custom_fields:
                        if isinstance(field, dict):
                            field_id = field.get('id', 'N/A')
                            field_key = field.get('key', field.get('name', 'N/A'))
                            field_value = field.get('fieldValue', field.get('field_value', field.get('value', 'N/A')))
                            print(f"  - {field_key} (ID: {field_id}): {field_value}")
                else:
                    # Intentar buscar campos personalizados en otros lugares
                    if 'nationality' in contact_data:
                        print(f"\n📋 Nacionalidad: {contact_data.get('nationality')}")
                    if 'study_type' in contact_data:
                        print(f"📋 Tipo de estudio: {contact_data.get('study_type')}")
                    if 'career_interest' in contact_data:
                        print(f"📋 Interés de carrera: {contact_data.get('career_interest')}")
                    
                    # Si no encontramos campos personalizados, mostrar toda la respuesta
                    if not any(key in contact_data for key in ['nationality', 'study_type', 'career_interest']):
                        print("\n⚠️  No se encontraron campos personalizados en la respuesta de la API.")
                        print("   Esto puede ser normal - la API puede no devolverlos en la respuesta.")
                        print("   ⚠️  IMPORTANTE: Verifica directamente en HighLevel si los campos se poblaron.")
                        print("   Ve a Contacts en HighLevel y busca el contacto por email:")
                        print(f"   {test_user_data['email']}")
                        print("\n   Si los campos están poblados en HighLevel, la integración está funcionando correctamente.")
                        print("\n   Respuesta completa (para debugging):")
                        import json
                        print(json.dumps(result, indent=2, ensure_ascii=False)[:800] + "...")
            else:
                print(result)
            
            print("-" * 60)
            print("\n✅ La integración está funcionando correctamente!")
            print("💡 Ahora puedes probar con un pago real y el contacto se creará automáticamente.")
            return True
        else:
            print("=" * 60)
            print("❌ ERROR: No se pudo crear el contacto")
            print("=" * 60)
            print("Revisa los logs arriba para más detalles del error.")
            return False
            
    except Exception as e:
        print("=" * 60)
        print("❌ ERROR INESPERADO")
        print("=" * 60)
        print(f"Error: {str(e)}")
        logger.exception("Error en prueba de HighLevel")
        return False


if __name__ == "__main__":
    print("\n🚀 Iniciando prueba de integración con HighLevel API\n")
    
    # Configurar logger para mostrar en consola
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>",
        level="INFO"
    )
    
    # Ejecutar prueba
    success = asyncio.run(test_create_contact())
    
    print()
    sys.exit(0 if success else 1)

