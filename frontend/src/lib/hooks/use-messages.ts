import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMessages, Message } from "@/lib/api-client";

export function useMessages(conversationId: string | null) {
  return useQuery<Message[]>({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const msgs = await fetchMessages(conversationId || undefined);
      console.log(`【useMessages】 Fetched ${msgs.length} messages for conversation ${conversationId}`);
      if (msgs.length) {
        console.log(`【useMessages】 Message IDs: ${msgs.map((m) => m.id).join(', ')}`);
      }
      return msgs;
    },
    enabled: !!conversationId, // Solo ejecutar si hay conversationId
    staleTime: 0, // siempre stale para refetch inmediato
    gcTime: 0, // no mantener cache para evitar respuestas parciales
    refetchOnMount: true,
    refetchOnWindowFocus: false,
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

