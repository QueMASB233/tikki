"""Gestión de resúmenes de conversación."""

from typing import Optional
from datetime import datetime
from supabase import Client
from loguru import logger


class ConversationMemory:
    """Gestión de resúmenes de conversación actual."""

    def __init__(self, supabase: Client):
        """Inicializa el gestor de resúmenes de conversación.
        
        Args:
            supabase: Cliente de Supabase.
        """
        self.supabase = supabase

    def get(self, conversation_id: str) -> Optional[str]:
        """Obtiene el resumen de una conversación.
        
        Args:
            conversation_id: ID de la conversación.
            
        Returns:
            Resumen de la conversación o None si no existe.
        """
        if not conversation_id:
            return None
        
        try:
            response = (
                self.supabase.table("conversation_summary")
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

    def update(self, conversation_id: str, summary: str, message_count: int) -> bool:
        """Actualiza o crea el resumen de una conversación.
        
        Args:
            conversation_id: ID de la conversación.
            summary: Resumen de la conversación.
            message_count: Número de mensajes en la conversación.
            
        Returns:
            True si se actualizó correctamente, False en caso contrario.
        """
        if not conversation_id:
            return False
        
        try:
            summary_value = summary.strip() if summary else ""
            
            # Si el resumen está vacío, eliminar el registro existente
            if not summary_value:
                self.supabase.table("conversation_summary").delete().eq(
                    "conversation_id", conversation_id
                ).execute()
                logger.info("Cleared conversation summary for conversation {}", conversation_id)
                return True
            
            # Intentar actualizar primero
            update_response = (
                self.supabase.table("conversation_summary")
                .update({
                    "summary": summary_value,
                    "message_count": message_count,
                    "updated_at": datetime.utcnow().isoformat(),
                })
                .eq("conversation_id", conversation_id)
                .execute()
            )

            # Si no existe, crear uno nuevo
            if not update_response.data:
                self.supabase.table("conversation_summary").insert({
                    "conversation_id": conversation_id,
                    "summary": summary_value,
                    "message_count": message_count,
                }).execute()

            logger.info("Updated conversation summary for conversation {}", conversation_id)
            return True
        except Exception as e:
            logger.error("Error updating conversation summary: {}", e)
            return False

    def get_message_count(self, conversation_id: str) -> int:
        """Obtiene el número de mensajes de una conversación.
        
        Args:
            conversation_id: ID de la conversación.
            
        Returns:
            Número de mensajes.
        """
        try:
            response = (
                self.supabase.table("messages")
                .select("id", count="exact")
                .eq("conversation_id", conversation_id)
                .execute()
            )
            return response.count if hasattr(response, "count") and response.count else 0
        except Exception as e:
            logger.error("Error getting message count: {}", e)
            return 0




