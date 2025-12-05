"""Módulo de retrieval RAG: búsqueda de chunks relevantes."""

from typing import List, Dict, Optional
from loguru import logger
from supabase import Client

from ..embeddings import get_embedding_generator


def retrieve_relevant_chunks(
    query: str,
    supabase_client: Client,
    top_k: int = 8,
    max_tokens: int = 4000,
) -> tuple[List[Dict], float]:
    """Recupera los chunks más relevantes para una query.
    
    Args:
        query: Texto de la consulta del usuario.
        supabase_client: Cliente de Supabase.
        top_k: Número máximo de chunks a recuperar.
        max_tokens: Límite aproximado de tokens para los chunks recuperados.
        
    Returns:
        Tupla con (lista de diccionarios con información de los chunks relevantes, max_similarity).
        max_similarity es el score de similitud más alto encontrado (0.0 si no hay chunks).
    """
    try:
        # 1. Generar embedding de la query
        embedding_generator = get_embedding_generator()
        query_embedding = embedding_generator.generate(query)

        if not query_embedding or all(x == 0.0 for x in query_embedding):
            logger.warning("No se pudo generar embedding para la query (modo fallback)")
            return [], 0.0

        # 2. Buscar chunks de documentos activos usando búsqueda vectorial
        # Primero obtener IDs de documentos activos
        active_docs_response = (
            supabase_client.table("knowledge_documents")
            .select("id")
            .eq("status", "active")
            .execute()
        )

        active_doc_ids = (
            [doc["id"] for doc in active_docs_response.data]
            if hasattr(active_docs_response, "data") and active_docs_response.data
            else []
        )

        if not active_doc_ids:
            logger.info("No hay documentos activos para buscar")
            return [], 0.0

        # 3. Búsqueda vectorial en document_chunks
        # Usar RPC para búsqueda vectorial (más eficiente)
        # Si no existe la función RPC, usar búsqueda manual
        try:
            # Intentar usar función RPC si existe
            rpc_response = supabase_client.rpc(
                "match_document_chunks",
                {
                    "query_embedding": query_embedding,
                    "match_threshold": 0.5,
                    "match_count": top_k * 2,  # Obtener más para filtrar después
                    "document_ids": active_doc_ids,
                },
            ).execute()

            chunks = rpc_response.data if hasattr(rpc_response, "data") and rpc_response.data else []
        except Exception as rpc_error:
            logger.warning("RPC function not available, using manual search: {}", rpc_error)
            # Búsqueda manual: obtener todos los chunks de documentos activos y calcular similitud
            chunks_response = (
                supabase_client.table("document_chunks")
                .select("id, document_id, chunk_index, content, embedding, token_count")
                .in_("document_id", active_doc_ids)
                .execute()
            )

            all_chunks = (
                chunks_response.data
                if hasattr(chunks_response, "data") and chunks_response.data
                else []
            )

            # Calcular similitud coseno manualmente
            import numpy as np

            query_vec = np.array(query_embedding)
            chunks_with_similarity = []
            for chunk in all_chunks:
                if chunk.get("embedding"):
                    chunk_vec = np.array(chunk["embedding"])
                    # Similitud coseno
                    similarity = np.dot(query_vec, chunk_vec) / (
                        np.linalg.norm(query_vec) * np.linalg.norm(chunk_vec)
                    )
                    chunks_with_similarity.append((similarity, chunk))

            # Ordenar por similitud y tomar top_k
            chunks_with_similarity.sort(key=lambda x: x[0], reverse=True)
            chunks = [chunk for _, chunk in chunks_with_similarity[: top_k * 2]]

        # 4. Filtrar y ordenar por similitud (si no viene de RPC)
        if chunks and "similarity" not in chunks[0]:
            # Calcular similitud si no viene en los resultados
            import numpy as np

            query_vec = np.array(query_embedding)
            chunks_with_sim = []
            for chunk in chunks:
                if chunk.get("embedding"):
                    chunk_vec = np.array(chunk["embedding"])
                    similarity = np.dot(query_vec, chunk_vec) / (
                        np.linalg.norm(query_vec) * np.linalg.norm(chunk_vec)
                    )
                    chunk["similarity"] = float(similarity)
                    chunks_with_sim.append(chunk)

            chunks = sorted(chunks_with_sim, key=lambda x: x.get("similarity", 0), reverse=True)

        # 5. Truncar según límite de tokens
        selected_chunks = []
        total_tokens = 0

        for chunk in chunks[:top_k]:
            chunk_tokens = chunk.get("token_count", 0) or (len(chunk.get("content", "")) // 4)
            if total_tokens + chunk_tokens <= max_tokens:
                selected_chunks.append(chunk)
                total_tokens += chunk_tokens
            else:
                break

        # Calcular max_similarity
        max_similarity = 0.0
        if selected_chunks:
            max_similarity = max(
                chunk.get("similarity", 0.0) for chunk in selected_chunks
            )

        logger.info(
            "Retrieved {} relevant chunks ({} tokens total, max_similarity={:.3f}) for query",
            len(selected_chunks),
            total_tokens,
            max_similarity,
        )

        return selected_chunks, max_similarity

    except Exception as e:
        logger.exception("Error retrieving chunks: {}", e)
        return [], 0.0


def format_chunks_for_prompt(chunks: List[Dict]) -> str:
    """Formatea los chunks recuperados para incluir en el prompt.
    
    Args:
        chunks: Lista de chunks recuperados.
        
    Returns:
        Texto formateado con los chunks.
    """
    if not chunks:
        return ""

    sections = ["=== DOCUMENTOS DEL CLIENTE ==="]
    sections.append(
        "Los siguientes fragmentos provienen de documentos académicos proporcionados por el administrador:"
    )
    sections.append("")

    for i, chunk in enumerate(chunks, 1):
        content = chunk.get("content", "").strip()
        if content:
            sections.append(f"[Documento {i}]")
            sections.append(content)
            sections.append("")

    sections.append("=== FIN DE DOCUMENTOS DEL CLIENTE ===")
    sections.append("")

    return "\n".join(sections)

