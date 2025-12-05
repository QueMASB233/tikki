-- Función RPC para búsqueda vectorial de chunks de documentos
-- Esta función busca chunks relevantes usando similitud coseno

create or replace function match_document_chunks(
    query_embedding vector(384),
    match_threshold float default 0.5,
    match_count int default 10,
    document_ids uuid[] default null
)
returns table (
    id uuid,
    document_id uuid,
    chunk_index integer,
    content text,
    embedding vector(384),
    token_count integer,
    similarity float
)
language plpgsql
as $$
begin
    return query
    select
        dc.id,
        dc.document_id,
        dc.chunk_index,
        dc.content,
        dc.embedding,
        dc.token_count,
        1 - (dc.embedding <=> query_embedding) as similarity
    from document_chunks dc
    inner join knowledge_documents kd on dc.document_id = kd.id
    where
        kd.status = 'active'
        and (document_ids is null or kd.id = any(document_ids))
        and 1 - (dc.embedding <=> query_embedding) > match_threshold
    order by dc.embedding <=> query_embedding
    limit match_count;
end;
$$;



