-- Migración a Supabase Auth
-- Paso 1: Agregar columna auth_user_id (vinculará con auth.users de Supabase)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- Paso 2: Crear índice para auth_user_id
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- Paso 3: Eliminar password_hash (ya no se almacena manualmente)
-- IMPORTANTE: Solo ejecutar esto después de migrar todos los usuarios a Supabase Auth
-- ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;

-- Paso 4: Hacer auth_user_id NOT NULL después de migrar todos los usuarios
-- ALTER TABLE public.users ALTER COLUMN auth_user_id SET NOT NULL;



