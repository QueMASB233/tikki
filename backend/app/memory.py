"""Módulo para gestión de memoria conversacional avanzada."""

from datetime import datetime
from typing import List, Optional

from loguru import logger
from supabase import Client


def get_semantic_memory(supabase: Client, user_id: str) -> str:
    """Recupera la memoria semántica del usuario."""
    try:
        response = (
            supabase.table("semantic_memory")
            .select("fact")
            .eq("user_id", user_id)
            .order("updated_at", desc=False)
            .execute()
        )
        facts = response.data or []
        if not facts:
            return ""
        return "\n".join([f"- {fact['fact']}" for fact in facts])
    except Exception as e:
        logger.error("Error retrieving semantic memory: {}", e)
        return ""


def get_episodic_memory(supabase: Client, user_id: str, limit: int = 5) -> str:
    """Recupera los resúmenes de sesiones anteriores (memoria episódica)."""
    try:
        response = (
            supabase.table("episodic_memory")
            .select("session_summary")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        summaries = response.data or []
        if not summaries:
            return ""
        return "\n".join([f"- {summary['session_summary']}" for summary in summaries])
    except Exception as e:
        logger.error("Error retrieving episodic memory: {}", e)
        return ""


def get_conversation_summary(supabase: Client, conversation_id: str) -> Optional[str]:
    """Recupera el resumen actual de la conversación."""
    if not conversation_id:
        return None
    try:
        response = (
            supabase.table("conversation_summary")
            .select("summary, message_count")
            .eq("conversation_id", conversation_id)
            .execute()
        )
        if response.data and len(response.data) > 0:
            return response.data[0].get("summary")
        return None
    except Exception as e:
        logger.error("Error retrieving conversation summary: {}", e)
        return None


def add_semantic_memory(supabase: Client, user_id: str, fact: str) -> bool:
    """Agrega un hecho a la memoria semántica."""
    if not fact or not fact.strip():
        return False
    try:
        supabase.table("semantic_memory").insert(
            {
                "user_id": user_id,
                "fact": fact.strip(),
            }
        ).execute()
        logger.info("Added semantic memory fact for user {}", user_id)
        return True
    except Exception as e:
        logger.error("Error adding semantic memory: {}", e)
        return False


def add_episodic_memory(
    supabase: Client, user_id: str, session_summary: str, message_count: int
) -> bool:
    """Agrega un resumen de sesión a la memoria episódica."""
    if not session_summary or not session_summary.strip():
        return False
    try:
        supabase.table("episodic_memory").insert(
            {
                "user_id": user_id,
                "session_summary": session_summary.strip(),
                "message_count": message_count,
            }
        ).execute()
        logger.info("Added episodic memory for user {}", user_id)
        return True
    except Exception as e:
        logger.error("Error adding episodic memory: {}", e)
        return False


def update_conversation_summary(
    supabase: Client, conversation_id: str, summary: str, message_count: int
) -> bool:
    """Actualiza o crea el resumen actual de la conversación.
    
    Si summary está vacío, elimina el resumen existente.
    """
    if not conversation_id:
        return False
    try:
        summary_value = summary.strip() if summary else ""
        
        # Si el resumen está vacío, eliminar el registro existente
        if not summary_value:
            supabase.table("conversation_summary").delete().eq("conversation_id", conversation_id).execute()
            logger.info("Cleared conversation summary for conversation {}", conversation_id)
            return True
        
        # Intentar actualizar primero
        update_response = (
            supabase.table("conversation_summary")
            .update(
                {
                    "summary": summary_value,
                    "message_count": message_count,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            )
            .eq("conversation_id", conversation_id)
            .execute()
        )

        # Si no existe, crear uno nuevo
        if not update_response.data:
            supabase.table("conversation_summary").insert(
                {
                    "conversation_id": conversation_id,
                    "summary": summary_value,
                    "message_count": message_count,
                }
            ).execute()

        logger.info("Updated conversation summary for conversation {}", conversation_id)
        return True
    except Exception as e:
        logger.error("Error updating conversation summary: {}", e)
        return False


def get_message_count(supabase: Client, conversation_id: Optional[str] = None, user_id: Optional[str] = None) -> int:
    """Obtiene el número total de mensajes de una conversación o del usuario."""
    try:
        query = supabase.table("messages").select("id", count="exact")
        if conversation_id:
            query = query.eq("conversation_id", conversation_id)
        elif user_id:
            query = query.eq("user_id", user_id)
        else:
            return 0
        response = query.execute()
        return response.count if hasattr(response, "count") and response.count else 0
    except Exception as e:
        logger.error("Error getting message count: {}", e)
        return 0


def should_create_episodic_memory(message_count: int, current_summary_count: int) -> bool:
    """Determina si se debe crear una nueva memoria episódica."""
    # Crear memoria episódica cada 20 mensajes o cuando el resumen actual tenga más de 10 mensajes
    return message_count % 20 == 0 or current_summary_count >= 10


def should_summarize_conversation(message_count: int) -> bool:
    """Determina si se debe resumir la conversación actual."""
    # Resumir cada 10 mensajes
    return message_count >= 10 and message_count % 10 == 0

