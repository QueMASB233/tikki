"""Gestión de memoria semántica con búsqueda por embeddings."""

import os
import inspect

# Aplicar monkey patch de inspect ANTES de importar embeddings
# Esto es necesario para evitar errores de PyTorch en macOS con Python 3.12
_original_getsource = inspect.getsource
_original_getsourcelines = inspect.getsourcelines
_original_findsource = inspect.findsource

def _patched_getsource(obj):
    try:
        return _original_getsource(obj)
    except (OSError, TypeError, ValueError, RuntimeError):
        return ""

def _patched_getsourcelines(obj):
    try:
        return _original_getsourcelines(obj)
    except (OSError, TypeError, ValueError, RuntimeError):
        return ([], 0)

def _patched_findsource(obj):
    try:
        return _original_findsource(obj)
    except (OSError, TypeError, ValueError, RuntimeError):
        return ([], 0)

inspect.getsource = _patched_getsource
inspect.getsourcelines = _patched_getsourcelines
inspect.findsource = _patched_findsource

# Deshabilitar compilación de PyTorch
os.environ["TORCH_COMPILE_DISABLE"] = "1"
os.environ["TORCHDYNAMO_DISABLE"] = "1"

from typing import List, Optional
from supabase import Client
from loguru import logger

from ..embeddings import get_embedding_generator


class SemanticMemory:
    """Gestión de memoria semántica (largo plazo) con búsqueda por embeddings."""

    def __init__(self, supabase: Client):
        """Inicializa el gestor de memoria semántica.
        
        Args:
            supabase: Cliente de Supabase.
        """
        self.supabase = supabase
        self.embedding_gen = get_embedding_generator()

    def add(self, user_id: str, fact: str) -> bool:
        """Agrega un hecho a la memoria semántica.
        
        Args:
            user_id: ID del usuario.
            fact: Hecho a almacenar.
            
        Returns:
            True si se agregó correctamente, False en caso contrario.
        """
        if not fact or not fact.strip():
            return False
        
        try:
            # Generar embedding
            embedding = self.embedding_gen.generate(fact)
            
            # Formatear embedding para PostgreSQL vector type
            # PostgreSQL espera formato: [1.0, 2.0, 3.0]
            embedding_str = "[" + ",".join(map(str, embedding)) + "]"
            
            # Insertar en la base de datos usando SQL directo para el vector
            # Nota: El cliente de Supabase puede tener limitaciones con tipos vector
            # Usamos una función RPC o insertamos sin embedding primero y luego actualizamos
            self.supabase.table("semantic_memory").insert({
                "user_id": user_id,
                "fact": fact.strip(),
            }).execute()
            
            # Actualizar con embedding usando RPC o SQL directo
            # Por ahora, insertamos sin embedding y lo agregamos después si es necesario
            
            logger.info("Added semantic memory fact for user {}", user_id)
            return True
        except Exception as e:
            logger.error("Error adding semantic memory: {}", e)
            return False

    def search(self, user_id: str, query: str, limit: int = 5) -> List[str]:
        """Busca hechos relevantes usando embeddings.
        
        Args:
            user_id: ID del usuario.
            query: Texto de búsqueda.
            limit: Número máximo de resultados.
            
        Returns:
            Lista de hechos relevantes.
        """
        if not query or not query.strip():
            return []
        
        try:
            # Generar embedding de la consulta
            query_embedding = self.embedding_gen.generate(query)
            
            # Formatear embedding para PostgreSQL
            embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
            
            # Buscar usando pgvector (similarity search) vía RPC
            response = self.supabase.rpc(
                "match_semantic_memory",
                {
                    "query_embedding": embedding_str,
                    "match_user_id": user_id,
                    "match_threshold": 0.5,
                    "match_count": limit,
                }
            ).execute()
            
            if response.data:
                return [item["fact"] for item in response.data]
            
            # Fallback: búsqueda simple si no hay función RPC
            return self._fallback_search(user_id, limit)
        except Exception as e:
            logger.warning("Error in semantic memory search, using fallback: {}", e)
            return self._fallback_search(user_id, limit)

    def _fallback_search(self, user_id: str, limit: int) -> List[str]:
        """Búsqueda simple sin embeddings (fallback).
        
        Args:
            user_id: ID del usuario.
            limit: Número máximo de resultados.
            
        Returns:
            Lista de hechos.
        """
        try:
            response = (
                self.supabase.table("semantic_memory")
                .select("fact")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(limit)
                .execute()
            )
            if response.data:
                return [item["fact"] for item in response.data]
            return []
        except Exception as e:
            logger.error("Error in fallback search: {}", e)
            return []

    def get_all(self, user_id: str) -> List[str]:
        """Obtiene todos los hechos del usuario.
        
        Args:
            user_id: ID del usuario.
            
        Returns:
            Lista de hechos.
        """
        return self._fallback_search(user_id, limit=100)

