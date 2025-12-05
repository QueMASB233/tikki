"""Gestión de memoria episódica con búsqueda por embeddings."""

from typing import List, Optional
from supabase import Client
from loguru import logger

from ..embeddings import get_embedding_generator


class EpisodicMemory:
    """Gestión de memoria episódica (resúmenes de sesiones) con búsqueda por embeddings."""

    def __init__(self, supabase: Client):
        """Inicializa el gestor de memoria episódica.
        
        Args:
            supabase: Cliente de Supabase.
        """
        self.supabase = supabase
        self.embedding_gen = get_embedding_generator()

    def add(self, user_id: str, session_summary: str, message_count: int) -> bool:
        """Agrega un resumen de sesión a la memoria episódica.
        
        Args:
            user_id: ID del usuario.
            session_summary: Resumen de la sesión.
            message_count: Número de mensajes en la sesión.
            
        Returns:
            True si se agregó correctamente, False en caso contrario.
        """
        if not session_summary or not session_summary.strip():
            return False
        
        try:
            # Generar embedding
            embedding = self.embedding_gen.generate(session_summary)
            
            # Insertar en la base de datos (sin embedding por ahora, se puede agregar después)
            # El cliente de Supabase puede tener limitaciones con tipos vector
            self.supabase.table("episodic_memory").insert({
                "user_id": user_id,
                "session_summary": session_summary.strip(),
                "message_count": message_count,
            }).execute()
            
            logger.info("Added episodic memory for user {}", user_id)
            return True
        except Exception as e:
            logger.error("Error adding episodic memory: {}", e)
            return False

    def search(self, user_id: str, query: str, limit: int = 5) -> List[str]:
        """Busca resúmenes relevantes usando embeddings.
        
        Args:
            user_id: ID del usuario.
            query: Texto de búsqueda.
            limit: Número máximo de resultados.
            
        Returns:
            Lista de resúmenes relevantes.
        """
        if not query or not query.strip():
            return []
        
        try:
            # Generar embedding de la consulta
            query_embedding = self.embedding_gen.generate(query)
            
            # Formatear embedding para PostgreSQL
            embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
            
            # Buscar usando pgvector vía RPC
            response = self.supabase.rpc(
                "match_episodic_memory",
                {
                    "query_embedding": embedding_str,
                    "match_user_id": user_id,
                    "match_threshold": 0.5,
                    "match_count": limit,
                }
            ).execute()
            
            if response.data:
                return [item["session_summary"] for item in response.data]
            
            # Fallback: búsqueda simple
            return self._fallback_search(user_id, limit)
        except Exception as e:
            logger.warning("Error in episodic memory search, using fallback: {}", e)
            return self._fallback_search(user_id, limit)

    def _fallback_search(self, user_id: str, limit: int) -> List[str]:
        """Búsqueda simple sin embeddings (fallback).
        
        Args:
            user_id: ID del usuario.
            limit: Número máximo de resultados.
            
        Returns:
            Lista de resúmenes.
        """
        try:
            response = (
                self.supabase.table("episodic_memory")
                .select("session_summary")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            if response.data:
                return [item["session_summary"] for item in response.data]
            return []
        except Exception as e:
            logger.error("Error in fallback search: {}", e)
            return []

    def get_recent(self, user_id: str, limit: int = 5) -> List[str]:
        """Obtiene los resúmenes más recientes.
        
        Args:
            user_id: ID del usuario.
            limit: Número máximo de resultados.
            
        Returns:
            Lista de resúmenes.
        """
        return self._fallback_search(user_id, limit)

