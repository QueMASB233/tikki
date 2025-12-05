# Integración con HighLevel API

Esta documentación explica cómo configurar y usar la integración con HighLevel para crear contactos automáticamente cuando un usuario completa el pago.

## ⚡ Configuración Rápida

Si ya tienes tu token de API (ya lo tienes: `pit-67d03c6e-8031-4df8-bc1e-6de12a546b31`), solo necesitas:

1. **Obtener tu Location ID** (ver instrucciones detalladas abajo)
2. **Agregar estas líneas a tu archivo `.env`**:
   ```env
   HIGHLEVEL_API_KEY=pit-67d03c6e-8031-4df8-bc1e-6de12a546b31
   HIGHLEVEL_BASE_URL=https://services.leadconnectorhq.com
   HIGHLEVEL_LOCATION_ID=tu_location_id_aqui  # ⚠️ Reemplaza con tu Location ID
   ```
3. **Reiniciar el servidor backend**

## Descripción

La integración crea automáticamente un contacto en HighLevel cuando:
1. Un usuario se registra en la plataforma
2. El usuario completa el pago exitosamente (webhook de Stripe `checkout.session.completed`)

**Importante**: El contacto solo se crea **después del pago exitoso**, no durante el registro.

## Requisitos Previos

1. Una cuenta activa en HighLevel con acceso a la API
2. Una subcuenta (Location) en HighLevel
3. Una API Key de HighLevel con permisos para crear contactos
4. El `locationId` de tu subcuenta en HighLevel

## Configuración

### 1. Obtener las Credenciales de HighLevel

#### Obtener la API Key:
✅ **Ya tienes tu API Key**: `pit-67d03c6e-8031-4df8-bc1e-6de12a546b31`

Si necesitas crear una nueva en el futuro:
1. Inicia sesión en tu cuenta de HighLevel
2. Ve a **Settings** → **Integrations** → **API**
3. Genera una nueva API Key con permisos para crear y ver contactos
4. Copia la API Key (formato: `pit-...` o `Bearer <token>`)

#### Obtener el Location ID:
1. En HighLevel, ve a **Settings** → **Locations**
2. Selecciona la subcuenta (location) que quieres usar
3. El Location ID aparece en la URL cuando estás en la configuración de la location
   - Ejemplo de URL: `https://app.gohighlevel.com/location/ABC123XYZ/settings`
   - En este caso, `ABC123XYZ` sería el Location ID
4. También puedes obtenerlo haciendo una llamada a la API:
   ```bash
   curl -X GET "https://services.leadconnectorhq.com/locations/" \
     -H "Authorization: Bearer pit-67d03c6e-8031-4df8-bc1e-6de12a546b31"
   ```
   Esto te devolverá una lista de locations con sus IDs. Busca el campo `id` en la respuesta.

5. **Prueba rápida**: Puedes probar que tu token funciona creando un contacto de prueba:
   ```bash
   curl -X POST "https://services.leadconnectorhq.com/contacts/?locationId=TU_LOCATION_ID" \
     -H "Authorization: Bearer pit-67d03c6e-8031-4df8-bc1e-6de12a546b31" \
     -H "Content-Type: application/json" \
     -d '{
       "firstName": "Test",
       "lastName": "User",
       "email": "test@example.com"
     }'
   ```
   (Reemplaza `TU_LOCATION_ID` con tu Location ID real)

**Una vez que tengas el Location ID, actualiza la variable `HIGHLEVEL_LOCATION_ID` en tu archivo `.env`.**

#### Obtener la Base URL:
- La URL base de la API de HighLevel es: `https://services.leadconnectorhq.com`
- O alternativamente: `https://rest.gohighlevel.com/v1` (dependiendo de tu versión de API)

### 2. Configurar Variables de Entorno

Agrega las siguientes variables a tu archivo `.env` en la raíz del proyecto backend (o en el directorio `backend/` si tu `.env` está ahí):

```env
# HighLevel API Configuration
HIGHLEVEL_API_KEY=pit-67d03c6e-8031-4df8-bc1e-6de12a546b31
HIGHLEVEL_BASE_URL=https://services.leadconnectorhq.com
HIGHLEVEL_LOCATION_ID=tu_location_id_aqui
```

**⚠️ IMPORTANTE**: 
- Reemplaza `tu_location_id_aqui` con el Location ID de tu subcuenta (ver instrucciones abajo)
- El token de API ya está configurado arriba, pero asegúrate de que esté en tu archivo `.env`
- **NUNCA** hardcodees estos valores en el código, siempre usa variables de entorno

**Nota**: Si no configuras estas variables, la integración simplemente se omitirá sin romper el flujo principal. Los logs mostrarán advertencias indicando que HighLevel no está configurado.

### 3. Verificar la Configuración

Después de configurar las variables de entorno:

1. **Verifica que el archivo `.env` tenga todas las variables**:
   ```env
   HIGHLEVEL_API_KEY=pit-67d03c6e-8031-4df8-bc1e-6de12a546b31
   HIGHLEVEL_BASE_URL=https://services.leadconnectorhq.com
   HIGHLEVEL_LOCATION_ID=tu_location_id_aqui  # ⚠️ Reemplaza esto con tu Location ID real
   ```

2. **Reinicia el servidor backend** para que cargue las nuevas variables de entorno:
   ```bash
   # Si el servidor está corriendo, deténlo (Ctrl+C) y reinícialo
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```

3. **Realiza un pago de prueba** usando las tarjetas de prueba de Stripe

4. **Revisa los logs del backend** para ver si el contacto se creó exitosamente

Los logs mostrarán:
- `HighLevel contact created successfully for user: <id> (email: <email>)` - ✅ Si fue exitoso
- `HighLevel API not configured. Skipping contact creation.` - ⚠️ Si faltan variables
- `HighLevel locationId not configured. Skipping contact creation.` - ⚠️ Si falta el Location ID
- `HighLevel API error creating contact...` - ❌ Si hubo un error en la API

## Datos que se Envían a HighLevel

La integración envía los siguientes datos del usuario a HighLevel:

### Campos Obligatorios:
- `firstName`: Extraído de `full_name` (primera palabra)
- `lastName`: Extraído de `full_name` (resto del nombre)
- `email`: Email del usuario
- `locationId`: ID de la subcuenta configurada

### Campos Opcionales (si existen en la base de datos):
- `source`: Valor de `study_type` (tipo de estudio)

**Nota**: 
- Solo se envían los campos que existen en la tabla `users` de tu base de datos. No se inventan datos.
- Los campos personalizados (`career_interest`, `nationality`) no se envían por defecto. Si necesitas enviarlos, debes configurar campos personalizados en HighLevel primero y luego actualizar el código para usar los nombres/IDs correctos de esos campos.

## Estructura del Código

### Archivos Creados:
- `backend/app/lib/highlevel/__init__.py`: Módulo de inicialización
- `backend/app/lib/highlevel/service.py`: Servicio principal de HighLevel

### Archivos Modificados:
- `backend/app/config.py`: Agregadas variables de entorno para HighLevel
- `backend/app/routes/billing.py`: Integrado el servicio en el webhook de Stripe

## Flujo de Ejecución

1. Usuario completa el pago en Stripe
2. Stripe envía webhook `checkout.session.completed` al backend
3. El backend actualiza el estado del usuario a `active`
4. El backend obtiene los datos completos del usuario de la base de datos
5. Se llama al servicio de HighLevel para crear el contacto
6. Si hay un error, se registra en los logs pero **no se interrumpe el flujo principal**

## Manejo de Errores

La integración está diseñada para ser resiliente:

- Si HighLevel no está configurado: Se omite silenciosamente (solo logs de advertencia)
- Si la API de HighLevel falla: Se registra el error en los logs pero el webhook continúa normalmente
- Si faltan datos del usuario: Se envían los campos disponibles (no se rompe)

**El flujo principal de pago nunca se interrumpe por errores de HighLevel.**

## Pruebas

### Prueba Manual:

1. Configura las variables de entorno
2. Crea un usuario de prueba
3. Completa un pago de prueba usando las tarjetas de prueba de Stripe
4. Verifica en HighLevel que el contacto se haya creado
5. Revisa los logs del backend para confirmar el proceso

### Verificar en HighLevel:

1. Inicia sesión en HighLevel
2. Ve a **Contacts**
3. Busca el contacto por email
4. Verifica que los datos estén correctos

## Solución de Problemas

### El contacto no se crea:

1. **Verifica las variables de entorno**:
   ```bash
   # En el directorio del backend
   echo $HIGHLEVEL_API_KEY
   echo $HIGHLEVEL_BASE_URL
   echo $HIGHLEVEL_LOCATION_ID
   ```
   
   O verifica directamente en tu archivo `.env`:
   ```bash
   # Desde la raíz del proyecto
   cat .env | grep HIGHLEVEL
   ```
   
   Deberías ver algo como:
   ```
   HIGHLEVEL_API_KEY=pit-67d03c6e-8031-4df8-bc1e-6de12a546b31
   HIGHLEVEL_BASE_URL=https://services.leadconnectorhq.com
   HIGHLEVEL_LOCATION_ID=tu_location_id_real
   ```

2. **Revisa los logs del backend**:
   - Busca mensajes que contengan "HighLevel"
   - Verifica si hay errores de autenticación o de formato

3. **Verifica la API Key**:
   - Asegúrate de que la API Key tenga permisos para crear contactos
   - Verifica que no haya espacios extra en la variable de entorno

4. **Verifica el Location ID**:
   - Confirma que el Location ID corresponde a una subcuenta válida
   - Asegúrate de que la API Key tenga acceso a esa location

### Errores Comunes:

- **401 Unauthorized**: API Key incorrecta o sin permisos
- **400 Bad Request**: Location ID incorrecto o formato de datos inválido
- **404 Not Found**: URL base incorrecta o endpoint no existe

## Referencias

- [Documentación Oficial de HighLevel API](https://marketplace.gohighlevel.com/docs/)
- [HighLevel API - Contacts](https://marketplace.gohighlevel.com/docs/apis/contacts)

## Notas Importantes

1. **No hardcodees valores sensibles**: Siempre usa variables de entorno
2. **Solo se crea después del pago**: El contacto no se crea durante el registro, solo después del pago exitoso
3. **Datos reales únicamente**: Solo se envían datos que existen en la tabla `users`
4. **Manejo de errores robusto**: Los errores no afectan el flujo principal de pago

## Soporte

Si encuentras problemas con la integración:
1. Revisa los logs del backend
2. Verifica la documentación oficial de HighLevel
3. Confirma que las credenciales sean correctas
4. Prueba la API de HighLevel directamente con herramientas como Postman o curl

