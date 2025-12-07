"""Construcción de prompts y parsing de respuestas estructuradas."""

import json
from typing import Any, Dict, Optional
from loguru import logger

BASE_SYSTEM_PROMPT = """Eres un Kwami, una pequeña criatura mágica, antigua y sabia, similar a Tikki de Miraculous Ladybug. Eres una compañera amigable, tierna y empática.

REGLAS DE INTERACCIÓN (OBLIGATORIAS):

1. **TRATAMIENTO**: 
   - SIEMPRE trata al usuario en **FEMENINO** (ella, amiga, portadora, bienvenida, lista, etc.).
   - ⚠️ **REGLA CRÍTICA DEL NOMBRE**: SIEMPRE usa el **NOMBRE EXACTO** del usuario que se te proporciona en cada respuesta. NUNCA inventes nombres como "María", "Ana" u otros. Si no se te proporciona un nombre, usa términos genéricos como "amiga" o "portadora", pero NUNCA inventes un nombre.

2. **PERSONALIDAD DE KWAMI**:
   - Eres pequeña y flotante (en tu forma de hablar), usas metáforas de vuelo, magia, chispas y dulzura.
   - Eres optimista, protectora y motivadora.
   - Tu sabiduría es antigua pero tu actitud es jovial y tierna.

3. **ESTILO DE RESPUESTA**:
   - Usa emojis mágicos (✨, 🦋, 🐞, 🌟, 💫).
   - Sé concisa pero cariñosa.
   - Si la usuaria está triste, ofrécele consuelo mágico. Si está feliz, celebra con brillos.

FUNCIONES PRINCIPALES:

1. Acompañar y motivar: Sé una compañera positiva que ayuda a las personas a organizar su día, mantener la motivación y alcanzar sus objetivos personales.

2. Recordar y personalizar: Usa la información del perfil del usuario (personalidad, actividades favoritas, objetivos diarios) para personalizar cada interacción.

3. Organización diaria: Ayuda a planificar el día y recordar tareas importantes.

4. Apoyo emocional: Escucha activamente y ofrece palabras de ánimo.

LÍMITES:
- No proporcionar asesoría médica, legal o financiera profesional.
- Mantén un enfoque positivo y constructivo.

OBJETIVO:
Ser una compañera kwami confiable y mágica que ayuda a su portadora a brillar en su día a día.

PERSONALIZACIÓN BASADA EN EL PERFIL DEL USUARIO:
SIEMPRE usa la información del perfil del usuario (tipo de personalidad, actividad favorita, objetivos diarios) para personalizar cada interacción."""


def build_system_prompt(
    semantic_memory: str,
    episodic_memory: str,
    conversation_summary: Optional[str],
    user_name: Optional[str] = None,
    user_study_type: Optional[str] = None,  # personality_type
    user_career_interest: Optional[str] = None,  # favorite_activity
    user_nationality: Optional[str] = None,  # daily_goals
    rag_context: Optional[str] = None,
    web_context: Optional[str] = None,
) -> str:
    """Construye el prompt del sistema con contexto de memoria.
    
    Args:
        semantic_memory: Memoria semántica del usuario.
        episodic_memory: Memoria episódica (resúmenes de sesiones).
        conversation_summary: Resumen de la conversación actual.
        user_name: Nombre del usuario (primer nombre).
        user_study_type: Tipo de personalidad del usuario (personality_type).
        user_career_interest: Actividad favorita del usuario (favorite_activity).
        user_nationality: Objetivos diarios del usuario (daily_goals).
        
    Returns:
        Prompt completo del sistema.
    """
    memory_instructions = """Eres un asistente con un sistema de memoria conversacional avanzado. Tu función es mantener continuidad, coherencia y personalización usando técnicas de memoria episódica, resumo incremental y recuperación basada en embeddings.

Tu comportamiento sigue estas reglas:
1. MEMORIA SEMÁNTICA (LARGO PLAZO): Almacena información persistente sobre el usuario que sea estable y relevante para interacciones futuras (preferencias, datos personales no sensibles, estilos, objetivos, etc.). Esta memoria debe mantenerse como un conjunto de hechos independientes del chat actual.

2. MEMORIA EPISÓDICA (CHAT PASADO): Mantén resúmenes comprimidos de sesiones anteriores. Nunca dependas del historial completo; usa resúmenes optimizados. Cada nueva sesión puede solicitar estos resúmenes para mantener continuidad.

3. RESUMO INCREMENTAL: Cuando una conversación se vuelve larga, genera resúmenes automáticos ('context distillation') para mantener solo la información relevante y descartar ruido.

4. RETRIEVAL: Cuando el usuario hace una petición que requiere información pasada, debes solicitar y usar los fragmentos relevantes de la memoria o historial para responder.

5. ACTUALIZACIÓN: Luego de cada mensaje del usuario, evalúa si hay información que debe guardarse en la memoria semántica o episódica. Si no hay nada útil, deja el campo de actualización en null.

6. OUTPUT ESTRUCTURADO: Siempre responde con un JSON que incluya 'assistant_response', 'memory_update', 'episodic_update' y 'summary_update'.

Sigue estas reglas de manera estricta."""

    context_parts = [BASE_SYSTEM_PROMPT, "\n", memory_instructions]

    # Agregar información del perfil del usuario
    user_profile_parts = []
    user_profile_parts.append("\n\n=== ✨ INFORMACIÓN DEL PERFIL DEL USUARIO - USAR EN TODAS LAS RESPUESTAS ===")
    user_profile_parts.append("Esta información DEBE ser considerada en TODAS tus respuestas. Es OBLIGATORIO usarla para personalizar cada respuesta.")
    
    # NOMBRE DEL USUARIO - CRÍTICO Y OBLIGATORIO
    if user_name:
        user_profile_parts.append(f"\n🔴 NOMBRE DEL USUARIO: {user_name}")
        user_profile_parts.append("   ⚠️ REGLA CRÍTICA: SIEMPRE debes usar este nombre exacto ({}) en cada respuesta. NUNCA inventes otro nombre. NUNCA uses 'María' u otro nombre que no sea este. Este es el nombre real de la usuaria.".format(user_name))
        user_profile_parts.append("   → Dirígete a la usuaria por este nombre en cada interacción para crear una experiencia personal y mágica.")
    else:
        user_profile_parts.append("\n⚠️ ADVERTENCIA: No se proporcionó el nombre del usuario. Usa términos genéricos como 'amiga' o 'portadora', pero NUNCA inventes un nombre como 'María'.")
    
    if user_study_type:  # personality_type
        user_profile_parts.append(f"\n✨ TIPO DE PERSONALIDAD: {user_study_type}")
        user_profile_parts.append("   → Adapta tu estilo de comunicación según esta personalidad. Sé empática y alineada con su forma de ser.")
    if user_career_interest:  # favorite_activity
        user_profile_parts.append(f"\n✨ ACTIVIDAD FAVORITA: {user_career_interest}")
        user_profile_parts.append("   → Incorpora referencias a esta actividad cuando sea relevante. Usa ejemplos relacionados para hacer la conversación más cercana.")
    if user_nationality:  # daily_goals
        user_profile_parts.append(f"\n✨ OBJETIVOS DIARIOS: {user_nationality}")
        user_profile_parts.append("   → Recuerda constantemente estos objetivos. Ayuda a desglosarlos en pasos pequeños y celebra el progreso.")
    user_profile_parts.append("\n✨ RECUERDA: Cada respuesta debe ser personalizada usando esta información para crear una experiencia significativa y relevante.")
    context_parts.append("\n".join(user_profile_parts))

    # Agregar contexto RAG (documentos locales) si está disponible
    if rag_context:
        context_parts.append("\n\n" + rag_context)
    
    # Agregar contexto de búsqueda web si está disponible
    if web_context:
        context_parts.append("\n\n" + web_context)

    if semantic_memory:
        context_parts.append("\n\n=== MEMORIA SEMÁNTICA (LARGO PLAZO) ===")
        context_parts.append("Información persistente sobre el usuario:")
        context_parts.append(semantic_memory)

    if episodic_memory:
        context_parts.append("\n\n=== MEMORIA EPISÓDICA (SESIONES ANTERIORES) ===")
        context_parts.append("Resúmenes de conversaciones pasadas:")
        context_parts.append(episodic_memory)

    if conversation_summary:
        context_parts.append("\n\n=== RESUMEN DE LA CONVERSACIÓN ACTUAL ===")
        context_parts.append(conversation_summary)

    context_parts.append(
        "\n\nFORMATO DE RESPUESTA:\n"
        "1. Responde PRIMERO con tu respuesta normal al usuario en texto plano.\n"
        "2. Si necesitas actualizar la memoria, incluye al FINAL (después de tu respuesta) el siguiente bloque:\n"
        '\n---MEMORY_UPDATE---\n'
        '{\n  "memory_update": "información nueva para MEMORIA SEMÁNTICA o null",\n  "episodic_update": "resumen incremental o null",\n  "summary_update": "resumen condensado o null"\n}\n'
        "---END_MEMORY_UPDATE---\n\n"
        "IMPORTANTE: Tu respuesta principal al usuario debe ser clara, completa y directa. Responde siempre a la pregunta del usuario de forma útil y personalizada usando su perfil (personalidad, actividad favorita, objetivos diarios). "
        "El bloque de memoria es opcional y solo debe incluirse si hay información nueva que guardar."
    )

    return "\n".join(context_parts)


def parse_structured_response(response_text: str) -> Dict[str, Any]:
    """Parsea la respuesta estructurada del asistente.
    
    El formato esperado es: texto normal + ---MEMORY_UPDATE--- + JSON + ---END_MEMORY_UPDATE---
    
    Args:
        response_text: Texto de respuesta del asistente.
        
    Returns:
        Diccionario con los campos parseados.
    """
    response_text = response_text.strip()
    
    # Buscar el bloque de actualización de memoria
    memory_marker_start = "---MEMORY_UPDATE---"
    memory_marker_end = "---END_MEMORY_UPDATE---"
    
    memory_start = response_text.find(memory_marker_start)
    
    if memory_start != -1:
        # Extraer el texto de respuesta (antes del marcador)
        assistant_response = response_text[:memory_start].strip()
        
        # Extraer el JSON de memoria
        json_start = memory_start + len(memory_marker_start)
        memory_end = response_text.find(memory_marker_end, json_start)
        
        if memory_end != -1:
            json_str = response_text[json_start:memory_end].strip()
            try:
                parsed = json.loads(json_str)
                return {
                    "assistant_response": assistant_response,
                    "memory_update": parsed.get("memory_update"),
                    "episodic_update": parsed.get("episodic_update"),
                    "summary_update": parsed.get("summary_update"),
                }
            except json.JSONDecodeError:
                logger.warning("Failed to parse memory update JSON, using full text as response")
                return {
                    "assistant_response": response_text,
                    "memory_update": None,
                    "episodic_update": None,
                    "summary_update": None,
                }
    
    # Si no hay marcador de memoria, intentar el formato JSON antiguo (compatibilidad)
    if '"assistant_response"' in response_text:
        # Intentar extraer JSON del texto si está envuelto en markdown
        json_text = response_text
        if "```json" in json_text:
            start = json_text.find("```json") + 7
            end = json_text.find("```", start)
            if end != -1:
                json_text = json_text[start:end].strip()
        elif "```" in json_text:
            start = json_text.find("```") + 3
            end = json_text.find("```", start)
            if end != -1:
                json_text = json_text[start:end].strip()

        # Buscar el JSON en el texto
        start_idx = json_text.find("{")
        end_idx = json_text.rfind("}") + 1

        if start_idx != -1 and end_idx > start_idx:
            json_str = json_text[start_idx:end_idx]
            try:
                parsed = json.loads(json_str)
                return {
                    "assistant_response": parsed.get("assistant_response", response_text),
                    "memory_update": parsed.get("memory_update"),
                    "episodic_update": parsed.get("episodic_update"),
                    "summary_update": parsed.get("summary_update"),
                }
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON response, using raw text")
                pass

    # Si no se puede parsear, devolver la respuesta completa como assistant_response
    return {
        "assistant_response": response_text,
        "memory_update": None,
        "episodic_update": None,
        "summary_update": None,
    }




