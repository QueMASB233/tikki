create extension if not exists "uuid-ossp";
create extension if not exists "vector";

create table if not exists public.users (
    id uuid primary key default uuid_generate_v4(),
    auth_user_id uuid unique references auth.users(id) on delete cascade,
    email text unique not null,
    full_name text,
    status text not null default 'pending' check (status in ('pending', 'active')),
    study_type text,
    career_interest text,
    nationality text,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_users_auth_user_id on public.users(auth_user_id);

create table if not exists public.messages (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.users(id) on delete cascade,
    role text not null check (role in ('system', 'user', 'assistant')),
    content text not null,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_messages_user_created_at on public.messages (user_id, created_at);

-- Tabla para conversaciones/chats
create table if not exists public.conversations (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.users(id) on delete cascade,
    title text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_conversations_user_id on public.conversations (user_id, updated_at);

-- Agregar conversation_id a messages (nullable para compatibilidad con datos existentes)
alter table public.messages 
add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;

create index if not exists idx_messages_conversation_id on public.messages (conversation_id, created_at);

-- Tabla para memoria semántica (largo plazo)
create table if not exists public.semantic_memory (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.users(id) on delete cascade,
    fact text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_semantic_memory_user_id on public.semantic_memory (user_id);

-- Agregar columna embedding si no existe (para tablas existentes)
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
    end if;
end $$;

-- Crear índice de embedding si no existe
do $$
begin
    if not exists (
        select 1 from pg_indexes 
        where schemaname = 'public' 
        and tablename = 'semantic_memory' 
        and indexname = 'idx_semantic_memory_embedding'
    ) then
        create index idx_semantic_memory_embedding 
        on public.semantic_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);
    end if;
end $$;

-- Tabla para memoria episódica (resúmenes de sesiones)
create table if not exists public.episodic_memory (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.users(id) on delete cascade,
    session_summary text not null,
    message_count integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_episodic_memory_user_id on public.episodic_memory (user_id, created_at);

-- Agregar columna embedding si no existe (para tablas existentes)
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
    end if;
end $$;

-- Crear índice de embedding si no existe
do $$
begin
    if not exists (
        select 1 from pg_indexes 
        where schemaname = 'public' 
        and tablename = 'episodic_memory' 
        and indexname = 'idx_episodic_memory_embedding'
    ) then
        create index idx_episodic_memory_embedding 
        on public.episodic_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);
    end if;
end $$;

-- Tabla para resumen actual de la conversación (ahora por conversación)
create table if not exists public.conversation_summary (
    id uuid primary key default uuid_generate_v4(),
    conversation_id uuid not null references public.conversations(id) on delete cascade unique,
    summary text not null,
    message_count integer not null default 0,
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_conversation_summary_conversation_id on public.conversation_summary (conversation_id);

