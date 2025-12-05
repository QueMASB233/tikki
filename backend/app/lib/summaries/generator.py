"""Generador de resúmenes automáticos."""

from typing import List, Dict
from loguru import logger

from ..model import LLMClient, get_llm_client


class SummaryGenerator:
    """Generador de resúmenes automáticos usando LLM."""

    def __init__(self, llm_client: LLMClient):
        """Inicializa el generador de resúmenes.
        
        Args:
            llm_client: Cliente LLM para generar resúmenes.
        """
        self.llm_client = llm_client

    async def generate_summary(self, messages: List[Dict[str, str]]) -> str:
        """Genera un resumen de una conversación.
        
        Args:
            messages: Lista de mensajes de la conversación.
            
        Returns:
            Resumen generado.
        """
        if not messages:
            return ""
        
        # Filtrar solo mensajes de usuario y asistente
        conversation_messages = [
            msg for msg in messages
            if msg.get("role") in ("user", "assistant")
        ]
        
        if not conversation_messages:
            return ""
        
        # Construir prompt para resumen
        conversation_text = "\n".join([
            f"{msg['role']}: {msg['content']}"
            for msg in conversation_messages
        ])
        
        summary_prompt = f"""Genera un resumen conciso y útil de la siguiente conversación. 
El resumen debe capturar los puntos clave, decisiones tomadas, y contexto importante para futuras interacciones.

Conversación:
{conversation_text}

Resumen:"""
        
        try:
            response = await self.llm_client.chat_completion([
                {"role": "system", "content": "Eres un asistente experto en generar resúmenes concisos y útiles."},
                {"role": "user", "content": summary_prompt}
            ], temperature=0.3, max_tokens=500)
            
            summary = (
                response.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            
            logger.info("Generated summary of {} messages", len(conversation_messages))
            return summary
        except Exception as e:
            logger.error("Error generating summary: {}", e)
            return ""


def get_summary_generator() -> SummaryGenerator:
    """Obtiene el generador de resúmenes."""
    llm_client = get_llm_client()
    return SummaryGenerator(llm_client)




