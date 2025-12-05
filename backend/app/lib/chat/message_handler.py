"""Función unificada sendMessage que maneja todo el flujo de chat."""

from dataclasses import dataclass
from typing import Optional, List, Dict
from datetime import datetime
from loguru import logger
from supabase import Client

from ..supabase import get_supabase_client
from ..memory import SemanticMemory, EpisodicMemory, ConversationMemory
from ..model import LLMClient, get_llm_client, build_system_prompt, parse_structured_response
from ..summaries import SummaryGenerator, get_summary_generator
from ..rag.retrieval import retrieve_relevant_chunks, format_chunks_for_prompt
from ..rag.web_search import search_web, format_web_results_for_prompt


@dataclass
class SendMessageResult:
    """Resultado de enviar un mensaje."""
    assistant_message_id: str
    assistant_content: str
    conversation_id: str
    memory_updated: bool
    summary_updated: bool
    episodic_updated: bool


# Constantes
SUMMARY_THRESHOLD = 10  # Resumir cada 10 mensajes
EPISODIC_THRESHOLD = 20  # Crear memoria episódica cada 20 mensajes
BOOKING_LINK = "https://api.elevabuilds.com/widget/bookings/asesoria-personal-91d23aa6-9776-40cb-bf3e-8a7156ef092365i58zoyat7y"

# Palabras clave para detectar solicitudes de asesoría personalizada
PERSONALIZED_ADVICE_KEYWORDS = [
    "asesoría personalizada",
    "asesoria personalizada",
    "asesor personal",
    "asesor personalizado",
    "asesoría individual",
    "asesoria individual",
    "asesor individual",
    "asesoría privada",
    "asesoria privada",
    "asesor privado",
    "consulta personalizada",
    "consulta personal",
    "consulta individual",
    "evaluar mi caso",
    "evaluar mi situación",
    "mi caso específico",
    "mi situación particular",
    "análisis de mi caso",
    "analisis de mi caso",
    "revisar mis documentos",
    "revisar mi documentación",
    "ayuda con mis trámites",
    "ayuda con mis tramites",
    "acompañamiento",
    "acompañar",
    "acompañar en el proceso",
    "estrategia migratoria",
    "estrategias migratorias",
    "plan personalizado",
    "plan personal",
    "asesoría legal",
    "asesoria legal",
    "abogado",
    "abogada",
    "asesor legal",
    "asesor jurídico",
    "asesor juridico",
]


def detect_personalized_advice_request(message: str) -> bool:
    """Detecta si el mensaje del usuario solicita asesoría personalizada.
    
    Args:
        message: Contenido del mensaje del usuario.
        
    Returns:
        True si se detecta una solicitud de asesoría personalizada, False en caso contrario.
    """
    message_lower = message.lower()
    # Normalizar acentos y caracteres especiales para mejor detección
    message_normalized = message_lower.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    
    for keyword in PERSONALIZED_ADVICE_KEYWORDS:
        keyword_normalized = keyword.lower().replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
        if keyword_normalized in message_normalized:
            logger.info("Detected personalized advice request with keyword: {}", keyword)
            return True
    
    return False


def get_personalized_advice_response() -> str:
    """Genera la respuesta automática para solicitudes de asesoría personalizada.
    
    Returns:
        Mensaje con el enlace de reserva de asesoría personalizada.
    """
    return (
        "Entiendo que necesitas una asesoría más detallada y personalizada. "
        "Para evaluar tu caso específico, analizar documentos, o recibir orientación personalizada "
        "sobre estrategias migratorias o trámites, te recomiendo agendar una sesión individual con nuestros asesores.\n\n"
        f"Puedes reservar tu asesoría personalizada aquí: {BOOKING_LINK}\n\n"
        "Mientras tanto, puedo ayudarte con información general sobre universidades, programas de estudio, "
        "requisitos de admisión y procesos académicos en España."
    )


async def send_message(
    user_id: str,
    conversation_id: Optional[str],
    message_content: str,
    stream: bool = False,
) -> SendMessageResult:
    """Función unificada que maneja todo el flujo de envío de mensaje.
    
    Esta función:
    1. Inserta el mensaje del usuario
    2. Obtiene o crea la conversación
    3. Recupera contexto de memoria (semántica, episódica, resumen)
    4. Obtiene mensajes recientes
    5. Construye el prompt
    6. Llama al LLM (con o sin streaming)
    7. Parsea la respuesta estructurada
    8. Inserta el mensaje del asistente
    9. Actualiza memorias según la respuesta
    10. Genera resumen automático si es necesario
    
    Args:
        user_id: ID del usuario.
        conversation_id: ID de la conversación (None para crear nueva).
        message_content: Contenido del mensaje del usuario.
        stream: Si es True, devuelve un stream (no implementado completamente).
        
    Returns:
        Resultado con información del mensaje enviado.
    """
    supabase = get_supabase_client()
    llm_client = get_llm_client()
    
    # Inicializar gestores de memoria
    semantic_memory = SemanticMemory(supabase)
    episodic_memory = EpisodicMemory(supabase)
    conversation_memory = ConversationMemory(supabase)
    summary_generator = get_summary_generator()
    
    # 0. Detectar si es una solicitud de asesoría personalizada
    if detect_personalized_advice_request(message_content):
        logger.info("Personalized advice request detected, returning automatic response")
        # Necesitamos crear/obtener conversación primero para poder insertar los mensajes
        if not conversation_id:
            title = message_content[:50] + "..." if len(message_content) > 50 else message_content
            conv_response = supabase.table("conversations").insert({
                "user_id": user_id,
                "title": title,
            }).execute()
            if not conv_response.data or len(conv_response.data) == 0:
                raise ValueError("No se pudo crear la conversación")
            conversation_id = conv_response.data[0]["id"]
        else:
            # Actualizar timestamp
            supabase.table("conversations").update({
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", conversation_id).execute()
        
        # Insertar mensaje del usuario
        user_msg_response = supabase.table("messages").insert({
            "user_id": user_id,
            "conversation_id": conversation_id,
            "role": "user",
            "content": message_content,
        }).execute()
        
        # Generar respuesta automática
        assistant_response = get_personalized_advice_response()
        
        # Insertar mensaje del asistente
        assistant_msg_response = supabase.table("messages").insert({
            "user_id": user_id,
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": assistant_response,
        }).execute()
        
        if not assistant_msg_response.data or len(assistant_msg_response.data) == 0:
            raise ValueError("No se pudo insertar el mensaje del asistente")
        
        return SendMessageResult(
            assistant_message_id=assistant_msg_response.data[0]["id"],
            assistant_content=assistant_response,
            conversation_id=conversation_id,
            memory_updated=False,
            summary_updated=False,
            episodic_updated=False,
        )
    
    # 1. Obtener o crear conversación
    if not conversation_id:
        title = message_content[:50] + "..." if len(message_content) > 50 else message_content
        conv_response = supabase.table("conversations").insert({
            "user_id": user_id,
            "title": title,
        }).execute()
        if not conv_response.data or len(conv_response.data) == 0:
            raise ValueError("No se pudo crear la conversación")
        conversation_id = conv_response.data[0]["id"]
    else:
        # Actualizar timestamp
        supabase.table("conversations").update({
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", conversation_id).execute()
    
    # 2. Insertar mensaje del usuario
    user_msg_response = supabase.table("messages").insert({
        "user_id": user_id,
        "conversation_id": conversation_id,
        "role": "user",
        "content": message_content,
    }).execute()
    
    if not user_msg_response.data or len(user_msg_response.data) == 0:
        raise ValueError("No se pudo insertar el mensaje del usuario")
    
    # 3. Recuperar contexto de memoria
    # Buscar memoria semántica relevante usando embeddings
    semantic_facts = semantic_memory.search(user_id, message_content, limit=5)
    semantic_context = "\n".join([f"- {fact}" for fact in semantic_facts]) if semantic_facts else ""
    
    # Buscar memoria episódica relevante
    episodic_summaries = episodic_memory.search(user_id, message_content, limit=5)
    episodic_context = "\n".join([f"- {summary}" for summary in episodic_summaries]) if episodic_summaries else ""
    
    # Obtener resumen de conversación actual
    conversation_summary = conversation_memory.get(conversation_id)
    
    # 3.5. RAG: Recuperar chunks relevantes de documentos activos
    # Umbral de similitud: si max_similarity >= 0.75, usar solo información local
    SIMILARITY_THRESHOLD = 0.75
    rag_chunks, max_similarity = retrieve_relevant_chunks(message_content, supabase, top_k=8, max_tokens=4000)
    rag_context = format_chunks_for_prompt(rag_chunks) if rag_chunks else ""
    
    # 3.6. Búsqueda web: solo si no hay chunks relevantes (max_similarity < threshold)
    web_results_context = ""
    use_web_search = max_similarity < SIMILARITY_THRESHOLD or not rag_chunks
    
    if use_web_search:
        logger.info(
            "Max similarity ({:.3f}) below threshold ({:.3f}), performing web search",
            max_similarity,
            SIMILARITY_THRESHOLD,
        )
        web_results = search_web(message_content, max_results=5)
        web_results_context = format_web_results_for_prompt(web_results) if web_results else ""
    else:
        logger.info(
            "Max similarity ({:.3f}) above threshold ({:.3f}), using only local documents",
            max_similarity,
            SIMILARITY_THRESHOLD,
        )
    
    # 3.5. Obtener información del perfil del usuario
    user_response = supabase.table("users").select("study_type, career_interest, nationality").eq("id", user_id).execute()
    user_data = user_response.data[0] if user_response.data and len(user_response.data) > 0 else {}
    user_study_type = user_data.get("study_type")
    user_career_interest = user_data.get("career_interest")
    user_nationality = user_data.get("nationality")
    
    # 4. Obtener mensajes recientes
    history_response = (
        supabase.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )
    history = history_response.data or []
    
    # Si hay resumen, usar solo los últimos mensajes
    if conversation_summary and len(history) > 5:
        recent_history = history[-5:]
    else:
        recent_history = history
    
    # 5. Construir prompt
    system_prompt = build_system_prompt(
        semantic_context,
        episodic_context,
        conversation_summary,
        user_study_type=user_study_type,
        user_career_interest=user_career_interest,
        user_nationality=user_nationality,
        rag_context=rag_context,
        web_context=web_results_context,
    )
    
    conversation_messages = [{"role": "system", "content": system_prompt}]
    for item in recent_history:
        conversation_messages.append({
            "role": item["role"],
            "content": item["content"]
        })
    conversation_messages.append({"role": "user", "content": message_content})
    
    # 6. Llamar al LLM
    if stream:
        # Streaming (para implementación futura)
        full_response = ""
        async for chunk in llm_client.chat_completion_stream(conversation_messages):
            full_response += chunk
        # Parsear después de recibir todo
        structured = parse_structured_response(full_response)
    else:
        # Sin streaming
        llm_response = await llm_client.chat_completion(conversation_messages)
        raw_response = (
            llm_response.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        if not raw_response:
            raise ValueError("El modelo no devolvió una respuesta")
        structured = parse_structured_response(raw_response)
    
    assistant_content = structured["assistant_response"]
    
    # 7. Insertar mensaje del asistente
    assistant_msg_response = supabase.table("messages").insert({
        "user_id": user_id,
        "conversation_id": conversation_id,
        "role": "assistant",
        "content": assistant_content,
    }).execute()
    
    if not assistant_msg_response.data or len(assistant_msg_response.data) == 0:
        raise ValueError("No se pudo insertar el mensaje del asistente")
    
    assistant_message_id = assistant_msg_response.data[0]["id"]
    
    # 8. Actualizar memorias
    memory_updated = False
    summary_updated = False
    episodic_updated = False
    
    # Actualizar memoria semántica
    memory_update = structured.get("memory_update")
    if memory_update and isinstance(memory_update, str) and memory_update.strip().lower() not in ("null", "none", ""):
        memory_updated = semantic_memory.add(user_id, memory_update)
    
    # Obtener conteo de mensajes
    message_count = conversation_memory.get_message_count(conversation_id)
    
    # Actualizar resumen de conversación
    summary_update = structured.get("summary_update")
    if summary_update and isinstance(summary_update, str) and summary_update.strip().lower() not in ("null", "none", ""):
        summary_updated = conversation_memory.update(conversation_id, summary_update, message_count)
    elif message_count >= SUMMARY_THRESHOLD and message_count % SUMMARY_THRESHOLD == 0:
        # Generar resumen automático si no hay summary_update pero se alcanzó el umbral
        if not summary_update or (isinstance(summary_update, str) and summary_update.strip().lower() in ("null", "none", "")):
            logger.info("Auto-generating summary for conversation {}", conversation_id)
            auto_summary = await summary_generator.generate_summary(conversation_messages)
            if auto_summary:
                summary_updated = conversation_memory.update(conversation_id, auto_summary, message_count)
    
    # Crear memoria episódica si es necesario
    episodic_update = structured.get("episodic_update")
    if message_count >= EPISODIC_THRESHOLD and message_count % EPISODIC_THRESHOLD == 0:
        if episodic_update and isinstance(episodic_update, str) and episodic_update.strip().lower() not in ("null", "none", ""):
            episodic_updated = episodic_memory.add(user_id, episodic_update, message_count)
            # Limpiar resumen actual después de crear memoria episódica
            conversation_memory.update(conversation_id, "", 0)
    
    logger.info(
        "Message processed: conversation={}, memory={}, summary={}, episodic={}",
        conversation_id, memory_updated, summary_updated, episodic_updated
    )
    
    return SendMessageResult(
        assistant_message_id=assistant_message_id,
        assistant_content=assistant_content,
        conversation_id=conversation_id,
        memory_updated=memory_updated,
        summary_updated=summary_updated,
        episodic_updated=episodic_updated,
    )




