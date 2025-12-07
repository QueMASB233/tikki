-- Agregar política RLS para eliminar mensajes
CREATE POLICY "Users can delete own messages" ON public.messages
    FOR DELETE USING (auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id));

