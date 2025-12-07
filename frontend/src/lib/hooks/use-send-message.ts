import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendMessageStream, createConversation, Message, Conversation } from "@/lib/api-client";

// Usar el mismo query key que useConversations
const CONVERSATIONS_QUERY_KEY = ["conversations"];

interface SendMessageOptions {
  content: string;
  conversationId: string | null;
  onChunk?: (chunk: string) => void;
  onCreateConversation?: (conversationId: string) => void;
  onStreamingMessageId?: (id: string) => void;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, conversationId, onChunk, onCreateConversation, onStreamingMessageId }: SendMessageOptions) => {
      let finalConversationId = conversationId;

      // Si no hay conversación, crear una primero
      if (!finalConversationId) {
        const title = content.length > 50 ? content.substring(0, 50) + "..." : content;
        console.log(`[useSendMessage] Creating new conversation with title: "${title}"`);
        
        const newConv = await createConversation(title);
        finalConversationId = newConv.id;
        
        console.log(`[useSendMessage] Conversation created: ${finalConversationId}`);
        
        // Actualizar cache de conversaciones con optimistic update
        // Usar el mismo query key que useConversations
        queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
          // Verificar que no exista ya (evitar duplicados)
          const exists = old.some(conv => conv.id === newConv.id);
          if (exists) {
            console.log(`[useSendMessage] Conversation ${finalConversationId} already in cache, updating`);
            return old.map(conv => conv.id === newConv.id ? newConv : conv);
          }
          console.log(`[useSendMessage] Adding new conversation to cache: ${old.length} -> ${old.length + 1}`);
          // Agregar al inicio y ordenar por updated_at descendente
          const updated = [newConv, ...old].sort((a, b) => 
            new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
          );
          return updated;
        });
        
        // Forzar refetch inmediato para asegurar sincronización
        await queryClient.refetchQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
        
        // Notificar al componente que se creó una conversación
        if (onCreateConversation) {
          onCreateConversation(finalConversationId);
        }
      }

      // Crear mensajes temporales para optimistic UI
      const tempUserMessageId = `temp-user-${Date.now()}`;
      const tempAssistantMessageId = `temp-assistant-${Date.now()}`;

      if (onStreamingMessageId) {
        onStreamingMessageId(tempAssistantMessageId);
      }

      const tempUserMessage: Message = {
        id: tempUserMessageId,
        content,
        role: "user",
        created_at: new Date().toISOString(),
      };

      const tempAssistantMessage: Message = {
        id: tempAssistantMessageId,
        content: "",
        role: "assistant",
        created_at: new Date().toISOString(),
      };

      // Optimistic update: agregar mensajes temporales
      queryClient.setQueryData<Message[]>(["messages", finalConversationId], (old = []) => {
        // Filtrar mensajes temporales previos y welcome
        const filtered = old.filter(
          (msg) =>
            !msg.id.startsWith("temp-") && msg.id !== "welcome-message"
        );
        return [...filtered, tempUserMessage, tempAssistantMessage];
      });

      return new Promise<{ messageId: string; conversationId: string; streamingMessageId: string }>((resolve, reject) => {
        sendMessageStream(
          content,
          finalConversationId,
          // onChunk: actualizar el mensaje temporal del asistente
          (chunk: string) => {
            queryClient.setQueryData<Message[]>(["messages", finalConversationId], (old = []) =>
              old.map((msg) =>
                msg.id === tempAssistantMessageId
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
            );
            if (onChunk) {
              onChunk(chunk);
            }
          },
          // onComplete: invalidar y refetch para obtener mensajes reales
          (messageId: string, completedConversationId: string) => {
            // Invalidar mensajes para refetch y obtener los mensajes reales de la BD
            // Esto reemplazará los mensajes temporales con los reales
            queryClient.invalidateQueries({ queryKey: ["messages", completedConversationId] });
            // Invalidar conversaciones para actualizar updated_at
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            resolve({ messageId, conversationId: completedConversationId, streamingMessageId: tempAssistantMessageId });
          },
          // onError: remover mensajes temporales y rechazar
          (error: string) => {
            queryClient.setQueryData<Message[]>(["messages", finalConversationId], (old = []) =>
              old.filter((msg) => !msg.id.startsWith("temp-"))
            );
            reject(new Error(error));
          }
        );
      });
    },
  });
}

