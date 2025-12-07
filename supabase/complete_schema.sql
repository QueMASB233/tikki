-- ============================================
-- SCHEMA COMPLETO - LADYBUG MIRACULOUS
-- ============================================
-- Ejecuta este script completo en Supabase SQL Editor
-- Asegúrate de tener las extensiones habilitadas

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- TABLA: users
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
    -- Campos personalizados para Ladybug (reemplazan los académicos)
    personality_type TEXT, -- Tipo de personalidad elegida en onboarding
    favorite_activity TEXT, -- Actividad favorita
    daily_goals TEXT, -- Objetivos diarios
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- ============================================
-- TABLA: conversations
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations (user_id, updated_at);

-- ============================================
-- TABLA: messages
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_messages_user_created_at ON public.messages (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id, created_at);

-- ============================================
-- TABLA: semantic_memory (Memoria semántica)
-- ============================================
CREATE TABLE IF NOT EXISTS public.semantic_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    fact TEXT NOT NULL,
    embedding VECTOR(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_user_id ON public.semantic_memory (user_id);
CREATE INDEX IF NOT EXISTS idx_semantic_memory_embedding ON public.semantic_memory 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- TABLA: episodic_memory (Memoria episódica)
-- ============================================
CREATE TABLE IF NOT EXISTS public.episodic_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_summary TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    embedding VECTOR(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_episodic_memory_user_id ON public.episodic_memory (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_embedding ON public.episodic_memory 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- TABLA: conversation_summary
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversation_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE UNIQUE,
    summary TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_conversation_summary_conversation_id ON public.conversation_summary (conversation_id);

-- ============================================
-- TABLA: billing_intents (Pagos Stripe)
-- ============================================
CREATE TABLE IF NOT EXISTS public.billing_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_session_id TEXT UNIQUE NOT NULL,
    stripe_customer_email TEXT,
    paid BOOLEAN DEFAULT FALSE NOT NULL,
    consumed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_intents_stripe_session_id ON public.billing_intents(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_billing_intents_paid ON public.billing_intents(paid);
CREATE INDEX IF NOT EXISTS idx_billing_intents_consumed ON public.billing_intents(consumed);

-- ============================================
-- TABLA: knowledge_documents (Documentos de conocimiento)
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('active', 'inactive', 'processing', 'deleted', 'error')),
    content_hash TEXT,
    processing_status TEXT,
    processing_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_admin_user_id ON public.knowledge_documents(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status ON public.knowledge_documents(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_content_hash ON public.knowledge_documents(content_hash);

-- ============================================
-- TABLA: document_chunks (Chunks de documentos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(384),
    token_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index ON public.document_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON public.document_chunks 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- TABLA: processing_logs (Logs de procesamiento)
-- ============================================
CREATE TABLE IF NOT EXISTS public.processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    log_type TEXT NOT NULL CHECK (log_type IN ('info', 'warning', 'error', 'success')),
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_processing_logs_document_id ON public.processing_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_created_at ON public.processing_logs(created_at DESC);

-- ============================================
-- FUNCIONES RPC PARA BÚSQUEDA VECTORIAL
-- ============================================

-- Función para buscar en memoria semántica
CREATE OR REPLACE FUNCTION match_semantic_memory(
  query_embedding VECTOR(384),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  fact TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    semantic_memory.id,
    semantic_memory.fact,
    1 - (semantic_memory.embedding <=> query_embedding) AS similarity
  FROM semantic_memory
  WHERE semantic_memory.user_id = match_user_id
    AND semantic_memory.embedding IS NOT NULL
    AND 1 - (semantic_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY semantic_memory.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Función para buscar en memoria episódica
CREATE OR REPLACE FUNCTION match_episodic_memory(
  query_embedding VECTOR(384),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  session_summary TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    episodic_memory.id,
    episodic_memory.session_summary,
    1 - (episodic_memory.embedding <=> query_embedding) AS similarity
  FROM episodic_memory
  WHERE episodic_memory.user_id = match_user_id
    AND episodic_memory.embedding IS NOT NULL
    AND 1 - (episodic_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY episodic_memory.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger para billing_intents
DROP TRIGGER IF EXISTS update_billing_intents_updated_at ON public.billing_intents;
CREATE TRIGGER update_billing_intents_updated_at 
    BEFORE UPDATE ON public.billing_intents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para conversations
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PERMISOS
-- ============================================
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

GRANT ALL ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

GRANT ALL ON public.semantic_memory TO authenticated;
GRANT ALL ON public.semantic_memory TO service_role;

GRANT ALL ON public.episodic_memory TO authenticated;
GRANT ALL ON public.episodic_memory TO service_role;

GRANT ALL ON public.conversation_summary TO authenticated;
GRANT ALL ON public.conversation_summary TO service_role;

GRANT ALL ON public.billing_intents TO authenticated;
GRANT ALL ON public.billing_intents TO service_role;

GRANT ALL ON public.knowledge_documents TO authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;

GRANT ALL ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;

GRANT ALL ON public.processing_logs TO authenticated;
GRANT ALL ON public.processing_logs TO service_role;

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================
-- Nota: Ajusta estas políticas según tus necesidades de seguridad

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semantic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summary ENABLE ROW LEVEL SECURITY;

-- Política básica: usuarios solo pueden ver/editar sus propios datos
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can view own conversations" ON public.conversations
    FOR SELECT USING (auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can create own conversations" ON public.conversations
    FOR INSERT WITH CHECK (auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can update own conversations" ON public.conversations
    FOR UPDATE USING (auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can delete own conversations" ON public.conversations
    FOR DELETE USING (auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT USING (auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can create own messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can delete own messages" ON public.messages
    FOR DELETE USING (auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can view own semantic memory" ON public.semantic_memory
    FOR SELECT USING (auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can view own episodic memory" ON public.episodic_memory
    FOR SELECT USING (auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can view own conversation summaries" ON public.conversation_summary
    FOR SELECT USING (auth.uid() = (SELECT auth_user_id FROM public.users WHERE id = (SELECT user_id FROM public.conversations WHERE id = conversation_id)));

-- ============================================
-- FIN DEL SCHEMA
-- ============================================


