-- Migración para agregar soporte de embeddings a tablas existentes
-- Ejecutar este script si las tablas ya existen sin las columnas de embedding

-- Asegurar que la extensión vector esté habilitada
create extension if not exists "vector";

-- Agregar columna embedding a semantic_memory si no existe
do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'semantic_memory' 
        and column_name = 'embedding'
    ) then
        alter table public.semantic_memory 
        add column embedding vector(384);
        
        -- Crear índice si no existe
        create index if not exists idx_semantic_memory_embedding 
        on public.semantic_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);
    end if;
end $$;

-- Agregar columna embedding a episodic_memory si no existe
do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'episodic_memory' 
        and column_name = 'embedding'
    ) then
        alter table public.episodic_memory 
        add column embedding vector(384);
        
        -- Crear índice si no existe
        create index if not exists idx_episodic_memory_embedding 
        on public.episodic_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);
    end if;
end $$;




