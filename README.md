# Estudia Seguro – Asesoría Académica con IA

Webapp estilo ChatGPT para asesoría académica con IA, construida con **Next.js + Tailwind CSS + TypeScript** en el frontend y **FastAPI** en el backend. Mantiene historial de conversación por usuario en **Supabase**, procesa pagos recurrentes de **Stripe Checkout** por USD $55/mes y utiliza la API de **DeepSeek** con un prompt base especializado.

## Estructura del proyecto

```
.
├── frontend/          # Next.js + Tailwind + TypeScript
├── backend/           # FastAPI (uvicorn) + Stripe + Supabase
├── supabase/          # Esquema SQL para tablas requeridas
└── .env.example       # Variables de entorno a copiar
```

## Requisitos previos

- Node.js 18+ y npm
- Python 3.10+
- Cuenta de Supabase (o Postgres compatible)
- Cuenta de Stripe con modo test habilitado
- Clave API de DeepSeek (`https://platform.deepseek.com/`)

## Configuración inicial

1. **Variables de entorno**

   Copia el archivo `.env.example` al nivel raíz y renómbralo según cada entorno:

   ```bash
   cp .env.example .env
   ```

   - Variables `NEXT_PUBLIC_*` son utilizadas por el frontend (Next.js).
   - Variables sin prefijo `NEXT_PUBLIC_` son consumidas por el backend FastAPI.
   - Ajusta `FRONTEND_URL` cuando despliegues en Vercel y `NEXT_PUBLIC_BACKEND_URL` al dominio donde publiques FastAPI.

2. **Supabase**

   - Crea un proyecto y habilita la extensión `uuid-ossp`.
   - Ejecuta el script `supabase/schema.sql` en el SQL editor para crear las tablas `users` y `messages`.
   - Desde *Project Settings → API* copia:
     - `Project URL` → `SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_URL`
     - `anon public` → `SUPABASE_ANON_KEY` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (solo backend).

3. **Stripe**

   - Activa *Billing → Products* y deja que este proyecto construya el precio dinámicamente (no requiere `price_id`).
   - Copia las claves desde *Developers → API keys*:
     - `STRIPE_SECRET_KEY`
     - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Crea un webhook (modo test) apuntando a `https://<backend-domain>/billing/webhook` y copia el `STRIPE_WEBHOOK_SECRET`.
   - Solicita los eventos: `checkout.session.completed`, `invoice.payment_failed`, `customer.subscription.deleted`.

4. **DeepSeek**

   - Genera un token y colócalo en `DEEPSEEK_API_KEY`.
   - El modelo utilizado es `deepseek-chat`.

## Instalación

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

### Backend (FastAPI)

Se recomienda usar `uv` o `pip`.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8000 --reload-exclude "*.venv/*" --reload-exclude "*/__pycache__/*"
```

> Asegúrate de cargar las variables de entorno antes de ejecutar (`export $(cat ../.env | xargs)` o usando `python-dotenv`).

## Funcionalidad clave

- **Landing page (`/`)**: explica el servicio y enlaza al flujo de pago.
- **Autenticación**: login/registro con email + contraseña. Estados de usuario:
  - `pending`: creado pero sin pago.
  - `active`: pago confirmado por webhook de Stripe.
- **Stripe Checkout**: suscripción mensual a $55 USD. Tras `checkout.session.completed` se marca al usuario como `active`.
- **Chat estilo ChatGPT**:
  - Layout inspirado en el repositorio [Chatbot UI by mckaywrigley](https://github.com/mckaywrigley/chatbot-ui) con sidebar, cabecera y burbujas tipo ChatGPT.
  - Prompt base cargado como sistema:  
    `"Eres un asesor académico experto..."`.
  - Se consulta a DeepSeek y se guarda cada turno en Supabase para mantener memoria por usuario.
- **Protección de rutas**: `/dashboard` requiere usuario activo. Tras pagar se refresca el perfil automáticamente.

## Despliegue en Vercel

1. **Frontend**
   - Importa el repositorio en Vercel y selecciona `frontend/` como directorio raíz.
   - Configura variables `NEXT_PUBLIC_*`.
   - Usa `npm install` y `npm run build`.

2. **Backend**
   - Despliega FastAPI en servicios compatibles (Railway, Render, Fly.io o Supabase Functions).
   - Configura las variables del backend y asegúrate de exponer `/billing/webhook`.
   - Actualiza `NEXT_PUBLIC_BACKEND_URL` y `FRONTEND_URL` con los dominios finales.

3. **Webhooks Stripe**
   - Vuelve a crear el endpoint de webhook apuntando al dominio público del backend.

## Testing manual sugerido

- Registro + redirección a Stripe.
- Webhook manual via CLI `stripe listen`.
- Login de usuario activo y verificación de acceso a `/dashboard`.
- Envío de mensajes y persistencia tras refrescar.
- Logout y bloqueo de sesión pendiente.

## Scripts útiles

- `supabase/schema.sql`: aplica el schema requerido.
- `frontend/package.json` scripts:
  - `dev`, `build`, `start`, `lint`.
- `backend/pyproject.toml`: instala dependencias con `pip install -e .` o usa `uv pip install -r`.

## Funcionalidades Avanzadas

### 🎵 Sistema de Sonidos

El proyecto incluye un sistema de efectos de sonido "cute" generados sintéticamente usando Web Audio API:

- **Sonido al enviar mensaje**: Sonido suave tipo "pop" cuando el usuario envía un mensaje
- **Sonido al recibir respuesta**: Sonido tipo "sparkle" cuando llega una respuesta del bot
- **Sonido de transformación**: Sonido brillante cuando se activa el modo transformación

**Configuración**: Edita `frontend/src/lib/config.ts`:
- `enableSounds`: Habilita/deshabilita los sonidos (default: `true`)
- `soundVolume`: Volumen de los efectos (0.0 a 1.0, default: `0.3`)

**Uso en componentes**:
```typescript
import { useSound } from "@/lib/sounds/sound-manager";

const { playSend, playReceive, playTransformation } = useSound();
playSend(); // Reproduce sonido de envío
```

### ✨ Animaciones Mágicas

Animaciones sutiles y de bajo costo visual para mejorar la experiencia:

- **MessageSendBurst**: Partículas que aparecen al enviar un mensaje
- **BotAvatarGlow**: Glow pulsante alrededor del avatar cuando el bot está "pensando"
- **TransformationFlash**: Destello rojo rápido cuando se activa el modo transformación

**Configuración**: Edita `frontend/src/lib/config.ts`:
- `enableMagicAnimations`: Habilita/deshabilita las animaciones (default: `true`)
- `particleIntensity`: Intensidad de las partículas (0.0 a 2.0, default: `1.0`)

**Componentes disponibles**:
```typescript
import { MessageSendBurst } from "@/components/animations/message-send-burst";
import { BotAvatarGlow } from "@/components/animations/bot-avatar-glow";
import { TransformationFlash } from "@/components/animations/transformation-flash";
```

### 🦋 Modo Transformación

Sistema especial que activa un modo "épico" del bot cuando se detecta una palabra clave:

**Activación**:
- Escribe la palabra clave configurada (default: `"transformación"`) en tu mensaje
- El bot activa automáticamente el modo transformación para esa respuesta
- Se reproduce un sonido especial y un destello visual

**Efectos**:
- El prompt del sistema se modifica para darle un tono más heroico y épico
- Duración: Solo para la respuesta actual (configurable en `transformationDuration`)

**Configuración**: Edita `frontend/src/lib/config.ts`:
- `transformationKeyword`: Palabra clave para activar el modo (default: `"transformación"`)
- `transformationDuration`: Duración en ms (default: `5000`)

**Uso programático**:
```typescript
import { 
  detectTransformationKeyword, 
  triggerTransformation,
  isTransformationModeActive 
} from "@/lib/personality/transformation-mode";

if (detectTransformationKeyword(message)) {
  triggerTransformation();
}
```

### 🔐 Hashing de Mensajes

Sistema de privacidad que hashea los mensajes antes de enviarlos al backend:

- Los mensajes se hashean usando SHA-256 en el cliente antes de enviarse
- El backend recibe el hash y el contenido original (para procesamiento)
- Opcionalmente, el backend puede almacenar solo el hash para mayor privacidad

**Configuración**: Edita `frontend/src/lib/config.ts`:
- `enableMessageHashing`: Habilita/deshabilita el hashing (default: `true`)

**Implementación**:
```typescript
import { hashMessage } from "@/lib/security/hash-message";

const hashedContent = await hashMessage("Mi mensaje");
```

**Backend**:
El backend acepta tanto mensajes hasheados como originales para mantener compatibilidad:
- Si `original_content` está presente, `content` es el hash
- Si no, `content` es el mensaje original (compatibilidad con clientes antiguos)

## Notas adicionales

- Este repositorio no incluye dependencias instaladas. Ejecuta `npm install` y `pip install -e .` la primera vez.
- Las claves sensibles deben residir únicamente en `.env` (no versionar).
- El backend espera tablas existentes en Supabase; no crea la infraestructura automáticamente.
- Los sonidos se generan sintéticamente usando Web Audio API, no requieren archivos externos.
- Las animaciones usan CSS puro y son de bajo costo de rendimiento.

