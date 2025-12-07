-- Verificar y corregir políticas RLS para conversaciones
-- Ejecuta este script en Supabase SQL Editor

-- Eliminar políticas existentes si hay duplicados
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;

-- Asegurar que RLS esté habilitado
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS correctas
-- Política para SELECT: usuarios solo pueden ver sus propias conversaciones
CREATE POLICY "Users can view own conversations" ON public.conversations
    FOR SELECT 
    USING (
        auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id)
    );

-- Política para INSERT: usuarios solo pueden crear conversaciones para sí mismos
CREATE POLICY "Users can create own conversations" ON public.conversations
    FOR INSERT 
    WITH CHECK (
        auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id)
    );

-- Política para UPDATE: usuarios solo pueden actualizar sus propias conversaciones
CREATE POLICY "Users can update own conversations" ON public.conversations
    FOR UPDATE 
    USING (
        auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id)
    )
    WITH CHECK (
        auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id)
    );

-- Política para DELETE: usuarios solo pueden eliminar sus propias conversaciones
CREATE POLICY "Users can delete own conversations" ON public.conversations
    FOR DELETE 
    USING (
        auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id)
    );

-- Verificar políticas de mensajes también
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can create own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT 
    USING (
        auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id)
    );

CREATE POLICY "Users can create own messages" ON public.messages
    FOR INSERT 
    WITH CHECK (
        auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id)
    );

CREATE POLICY "Users can delete own messages" ON public.messages
    FOR DELETE 
    USING (
        auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id)
    );

