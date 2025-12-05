-- Funciones RPC para búsqueda por embeddings usando pgvector

-- Función para buscar en memoria semántica
create or replace function match_semantic_memory(
  query_embedding vector(384),
  match_user_id uuid,
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  fact text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    semantic_memory.id,
    semantic_memory.fact,
    1 - (semantic_memory.embedding <=> query_embedding) as similarity
  from semantic_memory
  where semantic_memory.user_id = match_user_id
    and semantic_memory.embedding is not null
    and 1 - (semantic_memory.embedding <=> query_embedding) > match_threshold
  order by semantic_memory.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Función para buscar en memoria episódica
create or replace function match_episodic_memory(
  query_embedding vector(384),
  match_user_id uuid,
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  session_summary text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    episodic_memory.id,
    episodic_memory.session_summary,
    1 - (episodic_memory.embedding <=> query_embedding) as similarity
  from episodic_memory
  where episodic_memory.user_id = match_user_id
    and episodic_memory.embedding is not null
    and 1 - (episodic_memory.embedding <=> query_embedding) > match_threshold
  order by episodic_memory.embedding <=> query_embedding
  limit match_count;
end;
$$;




