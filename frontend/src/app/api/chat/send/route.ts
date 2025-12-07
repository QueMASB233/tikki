import { NextRequest } from "next/server";
import { getCurrentUser, getSupabaseClientWithAuth } from "@/lib/api/auth-helper";
import { encryptMessage, decryptMessage } from "@/lib/api/encryption";
import { chatCompletionStream } from "@/lib/api/deepseek";
import { buildSystemPrompt, parseStructuredResponse } from "@/lib/api/prompt";
import { MemoryManager } from "@/lib/api/memory";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const content = body.content?.trim();
    const conversationId = body.conversation_id || null;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "El mensaje no puede estar vacío" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseClientWithAuth(request);
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Error de autenticación" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    const memory = new MemoryManager(supabase);

    // Crear stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // 1. Obtener o crear conversación
          let finalConversationId = conversationId;
          if (!finalConversationId) {
            const title = content.length > 50 ? content.substring(0, 50) + "..." : content;
            const { data: newConv, error: convError } = await supabase
              .from("conversations")
              .insert({
                user_id: user.id,
                title,
              })
              .select()
              .single();

            if (convError || !newConv) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "No se pudo crear la conversación" })}\n\n`));
              controller.close();
              return;
            }

            finalConversationId = newConv.id;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversation_id: finalConversationId })}\n\n`));
          } else {
            // Actualizar timestamp
            await supabase
              .from("conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", finalConversationId);
          }

          // 2. Insertar mensaje del usuario
          const encryptedContent = await encryptMessage(content);
          const { data: userMsg, error: userMsgError } = await supabase
            .from("messages")
            .insert({
              user_id: user.id,
              conversation_id: finalConversationId,
              role: "user",
              content: encryptedContent,
            })
            .select()
            .single();

          if (userMsgError || !userMsg) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "No se pudo insertar el mensaje del usuario" })}\n\n`));
            controller.close();
            return;
          }

          // 3. Recuperar contexto de memoria
          const semanticFacts = await memory.searchSemantic(user.id, content, 5);
          const semanticContext = semanticFacts.length > 0 ? semanticFacts.map(f => `- ${f}`).join("\n") : "";

          const episodicSummaries = await memory.searchEpisodic(user.id, content, 5);
          const episodicContext = episodicSummaries.length > 0 ? episodicSummaries.map(s => `- ${s}`).join("\n") : "";

          const conversationSummary = await memory.getConversationSummary(finalConversationId);

          // 4. Obtener información del perfil del usuario
          const fullName = user.full_name || "";
          const userName = fullName ? fullName.split(" ")[0] : null;

          // 5. Obtener mensajes recientes
          const { data: history } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", finalConversationId)
            .order("created_at", { ascending: true });

          // Desencriptar mensajes
          const decryptedHistory = await Promise.all(
            (history || []).map(async (msg: any) => ({
              ...msg,
              content: await decryptMessage(msg.content),
            }))
          );

          const recentHistory = conversationSummary && decryptedHistory.length > 5
            ? decryptedHistory.slice(-5)
            : decryptedHistory;

          // 6. Construir prompt
          const systemPrompt = buildSystemPrompt({
            semanticMemory: semanticContext,
            episodicMemory: episodicContext,
            conversationSummary: conversationSummary || undefined,
            userName: userName || undefined,
            userPersonalityType: user.personality_type || undefined,
            userFavoriteActivity: user.favorite_activity || undefined,
            userDailyGoals: user.daily_goals || undefined,
          });

          const conversationMessages = [
            { role: "system" as const, content: systemPrompt },
            ...recentHistory.map((msg: any) => ({
              role: msg.role,
              content: msg.content,
            })),
            { role: "user" as const, content },
          ];

          // 7. Stream de respuesta del LLM
          let fullResponse = "";
          let lastSentLength = 0;
          const memoryMarker = "---MEMORY_UPDATE---";
          let chunksReceived = 0;

          try {
            for await (const chunk of chatCompletionStream(conversationMessages)) {
              chunksReceived++;
              fullResponse += chunk;

              if (fullResponse.includes(memoryMarker)) {
                const textPart = fullResponse.split(memoryMarker)[0];
                if (textPart.length > lastSentLength) {
                  const newChunk = textPart.substring(lastSentLength);
                  if (newChunk) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: newChunk })}\n\n`));
                    lastSentLength = textPart.length;
                  }
                }
              } else {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
                lastSentLength = fullResponse.length;
              }
            }

            if (chunksReceived === 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "El modelo no devolvió ninguna respuesta" })}\n\n`));
              controller.close();
              return;
            }

            if (!fullResponse || !fullResponse.trim()) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "El modelo devolvió una respuesta vacía" })}\n\n`));
              controller.close();
              return;
            }
          } catch (streamError: any) {
            console.error("Error en el stream del LLM:", streamError);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Error al obtener respuesta del modelo: ${streamError.message}` })}\n\n`));
            controller.close();
            return;
          }

          // 8. Parsear respuesta estructurada
          const structured = parseStructuredResponse(fullResponse);
          let assistantContent = structured.assistant_response?.trim() || "";

          if (!assistantContent) {
            assistantContent = fullResponse.split(memoryMarker)[0].trim();
          }

          if (!assistantContent) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "No se pudo procesar la respuesta del modelo" })}\n\n`));
            controller.close();
            return;
          }

          // Asegurar que se envió todo el contenido
          if (fullResponse.includes(memoryMarker)) {
            // Ya se envió todo antes del marcador
          } else if (assistantContent.length > lastSentLength) {
            const remaining = assistantContent.substring(lastSentLength);
            if (remaining) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: remaining })}\n\n`));
            }
          }

          // 9. Insertar mensaje del asistente
          const encryptedAssistantContent = await encryptMessage(assistantContent);
          const { data: assistantMsg, error: assistantMsgError } = await supabase
            .from("messages")
            .insert({
              user_id: user.id,
              conversation_id: finalConversationId,
              role: "assistant",
              content: encryptedAssistantContent,
            })
            .select()
            .single();

          if (assistantMsgError || !assistantMsg) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Error al guardar la respuesta" })}\n\n`));
            controller.close();
            return;
          }

          // 10. Actualizar memorias
          if (structured.memory_update && structured.memory_update.trim().toLowerCase() !== "null" && structured.memory_update.trim().toLowerCase() !== "none") {
            await memory.addSemantic(user.id, structured.memory_update);
          }

          const messageCount = await memory.getMessageCount(finalConversationId);

          if (structured.summary_update && structured.summary_update.trim().toLowerCase() !== "null" && structured.summary_update.trim().toLowerCase() !== "none") {
            await memory.updateConversationSummary(finalConversationId, structured.summary_update, messageCount);
          }

          if (messageCount >= 20 && messageCount % 20 === 0) {
            if (structured.episodic_update && structured.episodic_update.trim().toLowerCase() !== "null" && structured.episodic_update.trim().toLowerCase() !== "none") {
              await memory.addEpisodic(user.id, structured.episodic_update, messageCount);
              await memory.updateConversationSummary(finalConversationId, "", 0);
            }
          }

          // 11. Enviar mensaje final
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, message_id: assistantMsg.id, conversation_id: finalConversationId })}\n\n`));
          controller.close();
        } catch (error: any) {
          console.error("Error in streaming:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message || String(error) })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    console.error("POST /chat/send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error al procesar el mensaje" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

