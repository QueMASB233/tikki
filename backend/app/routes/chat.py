from datetime import datetime
from typing import List, Optional
import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from loguru import logger
from supabase import Client

from ..dependencies import get_current_user, get_supabase
from ..lib.chat import send_message as send_message_handler
from ..lib.model import get_llm_client, build_system_prompt, parse_structured_response
from ..lib.supabase import get_supabase_client
from ..lib.memory import SemanticMemory, EpisodicMemory, ConversationMemory
from ..lib.rag.retrieval import retrieve_relevant_chunks, format_chunks_for_prompt
from ..lib.rag.web_search import search_web, format_web_results_for_prompt
from ..schemas import (
    ChatRequest,
    ConversationResponse,
    CreateConversationRequest,
    UpdateConversationRequest,
    MessageResponse,
)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    supabase: Client = Depends(get_supabase),
    current_user=Depends(get_current_user),
):
    """Obtiene todas las conversaciones del usuario."""
    logger.info("Fetching conversations for {}", current_user["email"])
    response = (
        supabase.table("conversations")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("updated_at", desc=True)
        .execute()
    )
    conversations = response.data if hasattr(response, "data") and response.data else []
    return [
        ConversationResponse(
            id=conv["id"],
            title=conv.get("title"),
            created_at=datetime.fromisoformat(conv["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(conv["updated_at"].replace("Z", "+00:00")),
        )
        for conv in conversations
    ]


@router.post("/conversations", response_model=ConversationResponse)
def create_conversation(
    payload: CreateConversationRequest,
    supabase: Client = Depends(get_supabase),
    current_user=Depends(get_current_user),
):
    """Crea una nueva conversación."""
    logger.info("Creating conversation for {}", current_user["email"])
    response = (
        supabase.table("conversations")
        .insert(
            {
                "user_id": current_user["id"],
                "title": payload.title or "Nueva conversación",
            }
        )
        .execute()
    )
    if not response.data or len(response.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo crear la conversación.",
        )
    conv = response.data[0]
    return ConversationResponse(
        id=conv["id"],
        title=conv.get("title"),
        created_at=datetime.fromisoformat(conv["created_at"].replace("Z", "+00:00")),
        updated_at=datetime.fromisoformat(conv["updated_at"].replace("Z", "+00:00")),
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    supabase: Client = Depends(get_supabase),
    current_user=Depends(get_current_user),
):
    """Elimina una conversación y todos sus mensajes."""
    logger.info("Deleting conversation {} for user {}", conversation_id, current_user["email"])
    
    # Verificar que la conversación pertenezca al usuario
    response = (
        supabase.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada o no autorizada.",
        )
        
    # Eliminar conversación (los mensajes se eliminan en cascada si está configurado en la BD, 
    # de lo contrario habría que eliminarlos manualmente. Asumiremos cascada o eliminamos explícitamente)
    # Para seguridad, eliminamos mensajes primero
    supabase.table("messages").delete().eq("conversation_id", conversation_id).execute()
    
    # Eliminar la conversación
    supabase.table("conversations").delete().eq("id", conversation_id).execute()
    
    return None


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
def update_conversation(
    conversation_id: str,
    payload: UpdateConversationRequest,
    supabase: Client = Depends(get_supabase),
    current_user=Depends(get_current_user),
):
    """Actualiza el título de una conversación."""
    logger.info("Updating conversation {} for user {}", conversation_id, current_user["email"])
    
    response = (
        supabase.table("conversations")
        .update({"title": payload.title, "updated_at": datetime.now().isoformat()})
        .eq("id", conversation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada o no autorizada.",
        )
        
    conv = response.data[0]
    return ConversationResponse(
        id=conv["id"],
        title=conv.get("title"),
        created_at=datetime.fromisoformat(conv["created_at"].replace("Z", "+00:00")),
        updated_at=datetime.fromisoformat(conv["updated_at"].replace("Z", "+00:00")),
    )


@router.get("/history", response_model=List[MessageResponse])
def get_history(
    conversation_id: Optional[str] = None,
    supabase: Client = Depends(get_supabase),
    current_user=Depends(get_current_user),
):
    """Obtiene el historial de mensajes de una conversación específica o todas las conversaciones."""
    logger.info("Fetching chat history for {}", current_user["email"])
    
    query = (
        supabase.table("messages")
        .select("*")
        .eq("user_id", current_user["id"])
    )
    
    if conversation_id:
        query = query.eq("conversation_id", conversation_id)
    else:
        # Si no hay conversation_id, obtener mensajes sin conversación (compatibilidad)
        query = query.is_("conversation_id", "null")
    
    response = query.order("created_at", desc=False).execute()
    history = response.data if hasattr(response, "data") and response.data else []
    
    return [
        MessageResponse(
            id=item["id"],
            role=item["role"],
            content=item["content"],
            created_at=datetime.fromisoformat(item["created_at"].replace("Z", "+00:00")),
        )
        for item in history
    ]


@router.post("/send", response_model=MessageResponse)
async def send_message_endpoint(
    payload: ChatRequest,
    supabase: Client = Depends(get_supabase),
    current_user=Depends(get_current_user),
):
    """Endpoint para enviar un mensaje usando streaming con animación typewriter."""
    logger.info("User {} sending message (streaming)", current_user["email"])
    user_id = current_user["id"]
    content = payload.content.strip()
    
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El mensaje no puede estar vacío.",
        )

    async def generate_stream():
        try:
            supabase_client = get_supabase_client()
            llm_client = get_llm_client()
            
            # Inicializar gestores de memoria
            semantic_memory = SemanticMemory(supabase_client)
            episodic_memory = EpisodicMemory(supabase_client)
            conversation_memory = ConversationMemory(supabase_client)
            
            # 1. Obtener o crear conversación
            conversation_id = payload.conversation_id
            if not conversation_id:
                title = content[:50] + "..." if len(content) > 50 else content
                conv_response = supabase_client.table("conversations").insert({
                    "user_id": user_id,
                    "title": title,
                }).execute()
                if not conv_response.data or len(conv_response.data) == 0:
                    yield f"data: {json.dumps({'error': 'No se pudo crear la conversación'})}\n\n"
                    return
                conversation_id = conv_response.data[0]["id"]
                yield f"data: {json.dumps({'conversation_id': conversation_id})}\n\n"
            else:
                # Actualizar timestamp
                supabase_client.table("conversations").update({
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", conversation_id).execute()
            
            # 2. Insertar mensaje del usuario
            user_msg_response = supabase_client.table("messages").insert({
                "user_id": user_id,
                "conversation_id": conversation_id,
                "role": "user",
                "content": content,
            }).execute()
            
            if not user_msg_response.data or len(user_msg_response.data) == 0:
                yield f"data: {json.dumps({'error': 'No se pudo insertar el mensaje del usuario'})}\n\n"
                return
            
            # 3. Recuperar contexto de memoria
            semantic_facts = semantic_memory.search(user_id, content, limit=5)
            semantic_context = "\n".join([f"- {fact}" for fact in semantic_facts]) if semantic_facts else ""
            
            episodic_summaries = episodic_memory.search(user_id, content, limit=5)
            episodic_context = "\n".join([f"- {summary}" for summary in episodic_summaries]) if episodic_summaries else ""
            
            conversation_summary = conversation_memory.get(conversation_id)
            
            # 3.5. RAG: Recuperar chunks relevantes de documentos activos
            rag_chunks, max_similarity = retrieve_relevant_chunks(content, supabase_client, top_k=8, max_tokens=4000)
            rag_context = format_chunks_for_prompt(rag_chunks) if rag_chunks else ""
            
            # 3.6. Búsqueda web si no hay chunks relevantes o la similitud es baja
            web_search_results = []
            if not rag_chunks or max_similarity < 0.6:
                # Buscar información en internet para complementar
                web_search_results = search_web(content, max_results=5)
            web_context = format_web_results_for_prompt(web_search_results) if web_search_results else ""
            
            # 3.7. Obtener información del perfil del usuario
            user_response = supabase_client.table("users").select("study_type, career_interest, nationality").eq("id", user_id).execute()
            user_data = user_response.data[0] if user_response.data and len(user_response.data) > 0 else {}
            user_study_type = user_data.get("study_type")
            user_career_interest = user_data.get("career_interest")
            user_nationality = user_data.get("nationality")
            
            # 4. Obtener mensajes recientes
            history_response = (
                supabase_client.table("messages")
            .select("*")
                .eq("conversation_id", conversation_id)
                .order("created_at", desc=False)
            .execute()
        )
            history = history_response.data or []
            
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
                web_context=web_context,
            )
            
            # Agregar contexto RAG al prompt si existe
            if rag_context:
                system_prompt += "\n\n" + rag_context
            
            conversation_messages = [{"role": "system", "content": system_prompt}]
            for item in recent_history:
                conversation_messages.append({
                    "role": item["role"],
                    "content": item["content"]
                })
            conversation_messages.append({"role": "user", "content": content})
            
            # 6. Stream de respuesta del LLM
            full_response = ""
            assistant_message_id = None
            last_sent_length = 0
            memory_marker = "---MEMORY_UPDATE---"
            chunks_received = 0
            
            try:
                async for chunk in llm_client.chat_completion_stream(conversation_messages):
                    chunks_received += 1
                    full_response += chunk
                    
                    # Si encontramos el marcador de memoria, solo enviar el texto antes de él
                    if memory_marker in full_response:
                        # Extraer solo la parte antes del marcador
                        text_part = full_response.split(memory_marker)[0]
                        if len(text_part) > last_sent_length:
                            new_chunk = text_part[last_sent_length:]
                            if new_chunk:
                                yield f"data: {json.dumps({'chunk': new_chunk})}\n\n"
                                last_sent_length = len(text_part)
                    else:
                        # Enviar el chunk directamente (aún no hay marcador de memoria)
                        yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                        last_sent_length = len(full_response)
                
                # Verificar que recibimos al menos algún chunk
                if chunks_received == 0:
                    logger.error("No se recibieron chunks del LLM")
                    yield f"data: {json.dumps({'error': 'El modelo no devolvió ninguna respuesta'})}\n\n"
                    return
                
                # Verificar que tenemos contenido
                if not full_response or not full_response.strip():
                    logger.error("La respuesta del LLM está vacía")
                    yield f"data: {json.dumps({'error': 'El modelo devolvió una respuesta vacía'})}\n\n"
                    return
                    
            except Exception as stream_error:
                logger.error("Error en el stream del LLM: {}", stream_error)
                logger.exception("Full traceback:")
                yield f"data: {json.dumps({'error': f'Error al obtener respuesta del modelo: {str(stream_error)}'})}\n\n"
                return
            
            # 7. Parsear respuesta estructurada para obtener el contenido final y actualizaciones de memoria
            structured = parse_structured_response(full_response)
            assistant_content = structured.get("assistant_response", "").strip()
            
            # Validar que tenemos contenido de respuesta
            if not assistant_content:
                logger.error("No se pudo extraer contenido de la respuesta. Full response: {}", full_response[:500])
                yield f"data: {json.dumps({'error': 'No se pudo procesar la respuesta del modelo'})}\n\n"
                return
            
            # Asegurarse de que se envió todo el contenido de la respuesta (sin el JSON de memoria)
            if memory_marker in full_response:
                # Ya se envió todo antes del marcador, no hacer nada más
                pass
            elif assistant_content and len(assistant_content) > last_sent_length:
                # Enviar cualquier parte restante que no se haya enviado
                remaining = assistant_content[last_sent_length:]
                if remaining:
                    yield f"data: {json.dumps({'chunk': remaining})}\n\n"
            
            # 8. Insertar mensaje del asistente
            if not assistant_content:
                logger.error("No hay contenido para insertar como mensaje del asistente")
                yield f"data: {json.dumps({'error': 'No se pudo generar respuesta del asistente'})}\n\n"
                return
                
            assistant_msg_response = supabase_client.table("messages").insert({
                "user_id": user_id,
                "conversation_id": conversation_id,
                "role": "assistant",
                "content": assistant_content,
            }).execute()
            
            if not assistant_msg_response.data or len(assistant_msg_response.data) == 0:
                logger.error("No se pudo insertar el mensaje del asistente")
                yield f"data: {json.dumps({'error': 'Error al guardar la respuesta'})}\n\n"
                return
                
            assistant_message_id = assistant_msg_response.data[0]["id"]
            
            # 9. Actualizar memorias
            memory_update = structured.get("memory_update")
            if memory_update and isinstance(memory_update, str) and memory_update.strip().lower() not in ("null", "none", ""):
                semantic_memory.add(user_id, memory_update)
            
            message_count = conversation_memory.get_message_count(conversation_id)
            
            summary_update = structured.get("summary_update")
            if summary_update and isinstance(summary_update, str) and summary_update.strip().lower() not in ("null", "none", ""):
                conversation_memory.update(conversation_id, summary_update, message_count)
            
            episodic_update = structured.get("episodic_update")
            if message_count >= 20 and message_count % 20 == 0:
                if episodic_update and isinstance(episodic_update, str) and episodic_update.strip().lower() not in ("null", "none", ""):
                    episodic_memory.add(user_id, episodic_update, message_count)
                    conversation_memory.update(conversation_id, "", 0)
            
            # Enviar mensaje final con el ID (asegurar que siempre se envíe)
            if assistant_message_id:
                yield f"data: {json.dumps({'done': True, 'message_id': assistant_message_id, 'conversation_id': conversation_id})}\n\n"
            else:
                logger.error("No assistant_message_id available to send in done message")
                yield f"data: {json.dumps({'done': True, 'message_id': '', 'conversation_id': conversation_id})}\n\n"
            
        except Exception as e:
            logger.error("Error in streaming: {}", e)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
        )

