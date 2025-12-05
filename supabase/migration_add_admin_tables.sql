-- Tabla para documentos de conocimiento (knowledge_documents)
create table if not exists public.knowledge_documents (
    id uuid primary key default uuid_generate_v4(),
    admin_user_id uuid not null references public.users(id) on delete cascade,
    filename text not null,
    file_path text not null, -- Ruta en Supabase Storage
    file_size bigint,
    mime_type text,
    status text not null default 'processing' check (status in ('active', 'inactive', 'processing', 'deleted', 'error')),
    content_hash text, -- Hash del contenido para evitar reprocesamiento innecesario
    processing_status text, -- 'queued', 'processing', 'completed', 'failed'
    processing_error text, -- Mensaje de error si falla
    processed_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_knowledge_documents_admin_user_id on public.knowledge_documents(admin_user_id);
create index if not exists idx_knowledge_documents_status on public.knowledge_documents(status);
create index if not exists idx_knowledge_documents_content_hash on public.knowledge_documents(content_hash);

-- Tabla para chunks de documentos (document_chunks)
create table if not exists public.document_chunks (
    id uuid primary key default uuid_generate_v4(),
    document_id uuid not null references public.knowledge_documents(id) on delete cascade,
    chunk_index integer not null,
    content text not null,
    embedding vector(384), -- Usando el mismo modelo que semantic_memory (all-MiniLM-L6-v2)
    token_count integer, -- Aproximado
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_document_chunks_document_id on public.document_chunks(document_id);
create index if not exists idx_document_chunks_chunk_index on public.document_chunks(document_id, chunk_index);

-- Crear índice de embedding para búsqueda vectorial
do $$
begin
    if not exists (
        select 1 from pg_indexes 
        where schemaname = 'public' 
        and tablename = 'document_chunks' 
        and indexname = 'idx_document_chunks_embedding'
    ) then
        create index idx_document_chunks_embedding 
        on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
    end if;
end $$;

-- Tabla para logs de procesamiento (opcional pero recomendada)
create table if not exists public.processing_logs (
    id uuid primary key default uuid_generate_v4(),
    document_id uuid references public.knowledge_documents(id) on delete cascade,
    log_type text not null check (log_type in ('info', 'warning', 'error', 'success')),
    message text not null,
    metadata jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_processing_logs_document_id on public.processing_logs(document_id);
create index if not exists idx_processing_logs_created_at on public.processing_logs(created_at desc);



