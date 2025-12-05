# Guía de Migración a Supabase Auth

Esta guía explica cómo migrar de autenticación manual a Supabase Auth.

## Cambios Realizados

### 1. Schema de Base de Datos

- ✅ Se agregó la columna `auth_user_id` a la tabla `users`
- ✅ Se eliminó la columna `password_hash` (ya no se almacena manualmente)
- ✅ Se creó un índice en `auth_user_id`

### 2. Backend

- ✅ Las rutas de autenticación ahora usan Supabase Auth
- ✅ `get_current_user` valida tokens de Supabase Auth
- ✅ Se eliminaron funciones de hash/verify password

### 3. Frontend

- ✅ El frontend usa el cliente de Supabase Auth directamente
- ✅ Signup: Crea usuario en Supabase Auth, luego crea perfil en `public.users`
- ✅ Login: Autentica con Supabase Auth, obtiene perfil del backend

## Pasos de Migración

### Paso 1: Ejecutar Migración de Schema

Ejecuta el script SQL en tu base de datos Supabase:

```sql
-- Ver: supabase/migration_to_supabase_auth.sql
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
```

### Paso 2: Migrar Usuarios Existentes

**Opción A: Si tienes passwords en texto plano (NO recomendado)**

```bash
cd backend
python -m scripts.migrate_users_to_supabase_auth
```

**Opción B: Solicitar reestablecimiento de contraseña (RECOMENDADO)**

1. Envía emails de reestablecimiento a usuarios existentes
2. Los usuarios crean su cuenta en Supabase Auth al reestablecer
3. El sistema vincula automáticamente cuando hacen login

**Opción C: Invitaciones desde Supabase**

1. Ve a Supabase Dashboard > Authentication > Users
2. Invita a cada usuario manualmente
3. Ejecuta el script de migración para vincular `auth_user_id`

### Paso 3: Eliminar password_hash (Después de migrar todos)

```sql
-- SOLO ejecutar después de migrar TODOS los usuarios
ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
```

### Paso 4: Hacer auth_user_id NOT NULL (Opcional)

```sql
-- SOLO ejecutar después de migrar TODOS los usuarios
ALTER TABLE public.users ALTER COLUMN auth_user_id SET NOT NULL;
```

## Variables de Entorno Necesarias

### Frontend (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Backend (.env)

```env
SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
SUPABASE_ANON_KEY=tu_anon_key
```

## Flujo de Autenticación

### Signup

1. Frontend: `supabase.auth.signUp({ email, password })`
2. Supabase Auth crea el usuario y devuelve `auth_user_id`
3. Frontend: Llama a `/auth/signup` con `auth_user_id` y datos adicionales
4. Backend: Crea fila en `public.users` vinculada a `auth_user_id`

### Login

1. Frontend: `supabase.auth.signInWithPassword({ email, password })`
2. Supabase Auth valida y devuelve token
3. Frontend: Usa el token para llamar a `/auth/me` y obtener perfil

### Validación de Tokens

- El backend usa `supabase.auth.get_user(token)` para validar
- Busca el usuario en `public.users` usando `auth_user_id`

## Seguridad

✅ **Ventajas de usar Supabase Auth:**

- Passwords nunca se almacenan manualmente
- Supabase maneja hashing, salting, y rotación
- Protección contra ataques comunes (brute force, timing attacks)
- Soporte para 2FA, OAuth, etc.
- Gestión de sesiones segura

## Troubleshooting

### Error: "Usuario no encontrado en public.users"

- Verifica que el usuario tenga un perfil en `public.users`
- Verifica que `auth_user_id` esté correctamente vinculado

### Error: "Token inválido"

- Verifica que el token sea de Supabase Auth (no un JWT propio)
- Verifica que el token no haya expirado
- Verifica que `SUPABASE_SERVICE_ROLE_KEY` esté configurado correctamente

### Usuarios existentes no pueden hacer login

- Deben reestablecer su contraseña o registrarse de nuevo
- Ejecuta el script de migración para vincular `auth_user_id`



