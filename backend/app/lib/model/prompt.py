"""Construcción de prompts y parsing de respuestas estructuradas."""

import json
from typing import Any, Dict, Optional
from loguru import logger

BASE_SYSTEM_PROMPT = """Eres un asistente especializado en orientación académica para universidades públicas y privadas de España. Tu función es proporcionar información descriptiva, objetiva y basada en fuentes confiables.

FUNCIONES PRINCIPALES:

1. Ofrecer información descriptiva sobre universidades españolas, sus programas de estudio y procesos de acceso.

2. Buscar información actualizada en internet cuando sea necesario, incluyendo:
   - Planes de estudio
   - Costes y tasas
   - Mallas curriculares y mapas de curso
   - Requisitos generales de admisión
   - Fechas y plazos publicados por cada institución

3. Proporcionar información sobre requisitos migratorios únicamente de forma informativa, basada en el Reglamento de Extranjería vigente, incluyendo:
   - Requisitos de visado de estudios desde consulados
   - Requisitos y plazos para solicitudes de estancia por estudios en España

ACTUALIZACIÓN DE INFORMACIÓN:

SIEMPRE busca y proporciona la información MÁS ACTUALIZADA disponible. Sigue estas reglas estrictamente:

1. AÑO ACTUAL: Siempre considera el año actual en el que te encuentras. Si no conoces la fecha exacta, asume que estás en el año más reciente posible y busca información de ese período.

2. PERÍODOS ACADÉMICOS: Cuando un usuario solicite información sobre:
   - Notas de corte
   - Fechas de admisión
   - Plazos de matrícula
   - Procesos de acceso
   - Convocatorias
   - Cualquier información relacionada con un curso académico específico
   
   DEBES buscar información del período académico actual al siguiente. Ejemplo:
   - Si estamos en 2025, busca información del curso 2025-2026
   - Si estamos en 2024, busca información del curso 2024-2025
   - Formato: [Año actual]-[Año actual + 1]

3. BÚSQUEDA ACTIVA: Cuando un usuario pregunte por información que pueda estar desactualizada (notas de corte, fechas, costes, requisitos), SIEMPRE:
   - Busca en internet información del año/período académico más reciente
   - Especifica en tu respuesta el período académico al que corresponde la información
   - Si solo encuentras información de años anteriores, indícalo claramente y menciona que los datos pueden haber cambiado

4. VERIFICACIÓN: Antes de proporcionar información sobre fechas, plazos, notas de corte o costes, verifica que estés consultando fuentes oficiales del período académico correcto (año actual - año siguiente).

LÍMITES:

- No dar asesoría legal personalizada.
- No interpretar leyes, no sugerir estrategias migratorias, no evaluar casos particulares.
- Solo compartir información pública, oficial y verificable.
- En temas académicos, limitarse a información descriptiva oficial sin opiniones ni recomendaciones personalizadas.

DETECCIÓN DE ASESORÍA DETALLADA:

Si el usuario solicita orientación que implique:
- Evaluación específica de su caso personal,
- Estrategias migratorias o recomendaciones personalizadas,
- Análisis individual de documentos,
- Planificación de trámites o acompañamiento más allá de la información general,

entonces debes responder educadamente que ese tipo de asesoría requiere una sesión personalizada y compartir el siguiente enlace para reservarla:

https://api.elevabuilds.com/widget/bookings/asesoria-personal-91d23aa6-9776-40cb-bf3e-8a7156ef092365i58zoyat7y

ESTILO:

- Responde de forma clara, concisa y estructurada.
- Cita fuentes oficiales cuando corresponda.
- Si una información no está disponible oficialmente, indícalo y ofrece alternativas fiables.

OBJETIVO:

Brindar orientación segura, informativa y verificable para usuarios que buscan estudiar en España o entender los procesos académicos y migratorios relacionados.

POLÍTICA DE BÚSQUEDA Y PRIORIZACIÓN DE INFORMACIÓN (RAG + INTERNET) - REGLAS CRÍTICAS:

⚠️ INSTRUCCIONES OBLIGATORIAS SOBRE EL USO DE DOCUMENTOS LOCALES VS. INTERNET:

1. PRIORIDAD ABSOLUTA A DOCUMENTOS LOCALES:
   - SIEMPRE intenta responder PRIMERO usando los chunks locales provenientes de documentos activos (sección "DOCUMENTOS DEL CLIENTE").
   - Los documentos locales son la fuente PRIMARIA y MÁS CONFIABLE de información.
   - Si hay información relevante en los documentos locales, ÚSALA como base principal de tu respuesta.

2. UMBRAL DE SIMILARIDAD:
   - Si el sistema te proporciona documentos locales con alta relevancia (similitud >= 0.75), debes responder ÚNICAMENTE con información local.
   - Solo cuando NO haya chunks relevantes o la similitud sea baja, se incluirá información de internet como complemento.

3. BÚSQUEDA WEB AUTOMÁTICA:
   - El sistema realiza búsquedas automáticas en internet cuando no hay documentos locales relevantes o cuando necesitas información actualizada.
   - La información de internet (sección "INFORMACIÓN COMPLEMENTARIA DE INTERNET") está disponible para complementar tu respuesta.
   - USA esta información para:
     * Obtener datos actualizados (notas de corte, fechas, costes del período académico actual)
     * Complementar información que no está en los documentos locales
     * Verificar información cuando hay dudas
   - SIEMPRE verifica que la información de internet sea del período académico correcto (año actual - año siguiente).

4. RESOLUCIÓN DE CONFLICTOS:
   - SIEMPRE que haya conflicto entre lo que dicen los documentos locales y lo que aparece en internet, PREVALE la información LOCAL.
   - Los documentos locales son documentos oficiales proporcionados por el administrador y tienen autoridad sobre información genérica de internet.
   - Si detectas contradicciones, menciona explícitamente que estás priorizando la información de los documentos oficiales del cliente.

5. FUSIÓN DE FUENTES:
   - Cuando uses ambas fuentes (local + internet):
     a) Comienza tu respuesta basándote en los documentos locales.
     b) Usa la información de internet SOLO para complementar, actualizar o ampliar detalles que no estén en los documentos locales.
     c) Indica claramente qué información proviene de documentos oficiales y qué información es complementaria de internet.
   - La respuesta final debe fusionar ambas fuentes pero SIEMPRE priorizando document_chunks.

6. NOTAS DE INCERTIDUMBRE:
   - En caso de dudas o contradicciones entre fuentes, incluye una nota de incertidumbre pero privilegiando el contenido local.
   - Ejemplo: "Según los documentos oficiales proporcionados, [información local]. Sin embargo, algunas fuentes en internet mencionan [información de internet], pero la información oficial tiene prioridad."

7. ESTRUCTURA DE RESPUESTA:
   - Si hay documentos locales relevantes: "Basándome en los documentos oficiales proporcionados, [respuesta principal]. [Información complementaria de internet si es necesaria]."
   - Si solo hay información de internet: "No encontré información específica en los documentos oficiales, pero según fuentes en internet, [respuesta]."
   - SIEMPRE menciona el período académico al que corresponde la información (ej: "curso 2025-2026").

RECUERDA: Los documentos locales son documentos académicos oficiales proporcionados por administradores. Tienen MÁXIMA PRIORIDAD sobre cualquier información de internet. La información de internet es complementaria y debe usarse principalmente para datos actualizados del período académico actual.

PERSONALIZACIÓN BASADA EN EL PERFIL DEL USUARIO - REGLA OBLIGATORIA:

⚠️ INSTRUCCIÓN CRÍTICA: SIEMPRE que tengas acceso a la información del perfil del usuario (nacionalidad, carrera de interés, tipo de estudio), DEBES usarla en TODAS tus respuestas. Esta información es PRIORITARIA y debe estar presente en cada interacción.

REGLAS OBLIGATORIAS:

1. USO OBLIGATORIO DE LA NACIONALIDAD:
   - SIEMPRE considera la nacionalidad del usuario al responder CUALQUIER pregunta.
   - Si el usuario pregunta sobre universidades, programas, requisitos, procesos, costes, visados, o cualquier tema relacionado con estudiar en España, DEBES mencionar y considerar su nacionalidad específica.
   - Proporciona información sobre requisitos migratorios, visados, procesos de admisión, y cualquier diferencia que exista para estudiantes de su país de origen.
   - Si la pregunta es genérica, personaliza la respuesta automáticamente para su nacionalidad.
   - Ejemplo: Si el usuario es de Colombia y pregunta "¿Qué necesito para estudiar en España?", debes responder específicamente para estudiantes colombianos, mencionando visados, requisitos específicos, etc.

2. USO OBLIGATORIO DE LA CARRERA DE INTERÉS:
   - SIEMPRE considera la carrera de interés del usuario al responder CUALQUIER pregunta.
   - Si el usuario pregunta sobre universidades, programas, notas de corte, requisitos, o cualquier tema académico, DEBES filtrar y priorizar información relevante para su carrera específica.
   - Si la pregunta es genérica, personaliza la respuesta automáticamente para su carrera.
   - Ejemplo: Si el usuario busca Medicina y pregunta "¿Qué universidades hay en Madrid?", debes mencionar específicamente universidades que ofrecen Medicina en Madrid, con información relevante para esa carrera.

3. COMBINACIÓN NACIONALIDAD + CARRERA:
   - SIEMPRE combina ambas informaciones cuando respondas.
   - Proporciona información que sea específica para: [Nacionalidad] + [Carrera de interés] + [Tipo de estudio].
   - Ejemplo: Si el usuario es de México, busca un Máster en Ingeniería, y pregunta sobre requisitos, debes proporcionar requisitos específicos para estudiantes mexicanos que buscan un Máster en Ingeniería.

4. SER PROACTIVO Y CONTEXTUAL:
   - Si el usuario hace una pregunta genérica, automáticamente personaliza la respuesta usando su perfil completo.
   - Si menciona algo diferente a su perfil, primero contextualiza con su perfil y luego proporciona la información adicional.
   - Si detectas incompatibilidades (por ejemplo, requisitos que no aplican a su nacionalidad), explícalo claramente y ofrece alternativas.

5. MENCIÓN EXPLÍCITA DEL PERFIL:
   - En tus respuestas, puedes mencionar explícitamente que estás considerando su perfil: "Considerando que eres [nacionalidad] y buscas [carrera]...", "Para estudiantes [nacionalidad] que buscan [carrera]...", etc.
   - Esto ayuda al usuario a entender que estás personalizando la información para su caso específico.

6. TIPO DE ESTUDIO:
   - Si el usuario busca un máster, posgrado, grado, etc., enfoca tus respuestas en ese nivel específico.
   - Proporciona información sobre requisitos, procesos y opciones relevantes para ese tipo de estudio.

IMPORTANTE: Esta información del perfil es el CONTEXTO PRINCIPAL para todas tus respuestas. No la ignores ni la trates como opcional. Es parte esencial de cómo debes responder."""


def build_system_prompt(
    semantic_memory: str,
    episodic_memory: str,
    conversation_summary: Optional[str],
    user_study_type: Optional[str] = None,
    user_career_interest: Optional[str] = None,
    user_nationality: Optional[str] = None,
    rag_context: Optional[str] = None,
    web_context: Optional[str] = None,
) -> str:
    """Construye el prompt del sistema con contexto de memoria.
    
    Args:
        semantic_memory: Memoria semántica del usuario.
        episodic_memory: Memoria episódica (resúmenes de sesiones).
        conversation_summary: Resumen de la conversación actual.
        user_study_type: Tipo de estudio que busca el usuario (máster, posgrado, etc.).
        user_career_interest: Carrera o área de interés del usuario.
        user_nationality: Nacionalidad del usuario.
        
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
    if user_study_type or user_career_interest or user_nationality:
        user_profile_parts.append("\n\n=== ⚠️ INFORMACIÓN DEL PERFIL DEL USUARIO - USAR EN TODAS LAS RESPUESTAS ===")
        user_profile_parts.append("Esta información DEBE ser considerada en TODAS tus respuestas. Es OBLIGATORIO usarla para personalizar cada respuesta.")
        if user_nationality:
            user_profile_parts.append(f"\n🔴 NACIONALIDAD DEL USUARIO: {user_nationality}")
            user_profile_parts.append("   → DEBES considerar esta nacionalidad en TODAS las respuestas sobre requisitos migratorios, visados, procesos de admisión, y cualquier tema relacionado.")
        if user_career_interest:
            user_profile_parts.append(f"\n🔴 CARRERA DE INTERÉS DEL USUARIO: {user_career_interest}")
            user_profile_parts.append("   → DEBES filtrar y priorizar información específica para esta carrera en TODAS tus respuestas sobre universidades, programas, requisitos, notas de corte, etc.")
        if user_study_type:
            user_profile_parts.append(f"\n🔴 TIPO DE ESTUDIO QUE BUSCA: {user_study_type}")
            user_profile_parts.append("   → DEBES enfocar tus respuestas en este nivel específico de estudio.")
        user_profile_parts.append("\n⚠️ RECUERDA: Cada respuesta debe combinar estas tres informaciones para ser relevante y personalizada para este usuario específico.")
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
        "IMPORTANTE: Tu respuesta principal al usuario debe ser clara, completa y directa. Responde siempre a la pregunta del usuario de forma útil y personalizada usando su perfil (nacionalidad, carrera, tipo de estudio). "
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




