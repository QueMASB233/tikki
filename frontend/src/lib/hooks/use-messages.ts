import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMessages, Message } from "@/lib/api-client";

export function useMessages(conversationId: string | null) {
  return useQuery<Message[]>({
    queryKey: ["messages", conversationId],
    queryFn: () => fetchMessages(conversationId || undefined),
    enabled: !!conversationId, // Solo ejecutar si hay conversationId
    staleTime: 1000 * 30, // 30 seconds
    // Mantener los datos en cache incluso cuando se deshabilita la query
    // Esto permite que los mensajes temporales se muestren mientras se carga
    placeholderData: (previousData) => previousData,
  });
}

export function useInvalidateMessages() {
  const queryClient = useQueryClient();

  return (conversationId: string | null) => {
    if (conversationId) {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }
  };
}

