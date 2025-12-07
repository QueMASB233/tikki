import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchConversations, createConversation, deleteConversation, renameConversation, Conversation } from "@/lib/api-client";

const CONVERSATIONS_QUERY_KEY = ["conversations"];

export function useConversations() {
  return useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: fetchConversations,
    staleTime: 0, // Siempre considerar los datos como stale para forzar refetch
    refetchOnMount: true, // Refetch al montar el componente
    refetchOnWindowFocus: false, // No refetch al cambiar de ventana
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => createConversation(title),
    onSuccess: async (newConversation) => {
      console.log(`[useCreateConversation] Conversation created: ${newConversation.id}`);
      // Optimistic update: agregar la nueva conversación al inicio de la lista
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
        // Verificar que no exista ya (evitar duplicados)
        const exists = old.some(conv => conv.id === newConversation.id);
        if (exists) {
          console.log(`[useCreateConversation] Conversation ${newConversation.id} already in cache, updating`);
          // Retornar nuevo array para forzar re-render
          return old.map(conv => conv.id === newConversation.id ? newConversation : conv);
        }
        console.log(`[useCreateConversation] Adding to cache: ${old.length} -> ${old.length + 1}`);
        // Ordenar por updated_at descendente y retornar nuevo array
        const updated = [newConversation, ...old].sort((a, b) => 
          new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        );
        console.log(`[useCreateConversation] Updated conversation IDs: ${updated.map(c => c.id).join(', ')}`);
        return [...updated]; // Nuevo array para forzar re-render
      });
      // Forzar refetch inmediato para asegurar sincronización
      await queryClient.refetchQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => {
      console.log(`[useDeleteConversation] Deleting conversation: ${conversationId}`);
      return deleteConversation(conversationId);
    },
    onMutate: async (conversationId) => {
      console.log(`[useDeleteConversation] onMutate: ${conversationId}`);
      
      // Cancelar queries en progreso para evitar sobrescribir el optimistic update
      await queryClient.cancelQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: ["messages", conversationId] });

      // Snapshot del valor anterior
      const previousConversations = queryClient.getQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY);
      console.log(`[useDeleteConversation] Previous conversations count: ${previousConversations?.length || 0}`);

      // Optimistic update: remover la conversación inmediatamente
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
        const filtered = old.filter((conv) => conv.id !== conversationId);
        console.log(`[useDeleteConversation] Optimistic update: ${old.length} -> ${filtered.length} conversations`);
        console.log(`[useDeleteConversation] Remaining conversation IDs: ${filtered.map(c => c.id).join(', ')}`);
        // Retornar nuevo array para forzar re-render
        return [...filtered];
      });

      // Remover queries de mensajes de esta conversación del cache
      queryClient.removeQueries({ queryKey: ["messages", conversationId] });
      
      // Limpiar cualquier referencia en otros queries relacionados
      queryClient.removeQueries({ 
        queryKey: ["messages", conversationId],
        exact: false 
      });

      return { previousConversations, conversationId };
    },
    onError: (err, conversationId, context) => {
      console.error(`[useDeleteConversation] Error deleting conversation ${conversationId}:`, err);
      // Rollback en caso de error
      if (context?.previousConversations) {
        console.log(`[useDeleteConversation] Rolling back to previous state`);
        queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, context.previousConversations);
      }
    },
    onSuccess: async (data, conversationId) => {
      console.log(`[useDeleteConversation] Successfully deleted conversation ${conversationId}`);
      // Forzar refetch inmediato para asegurar sincronización
      await queryClient.refetchQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      // Asegurar que los mensajes también se limpien
      queryClient.removeQueries({ queryKey: ["messages", conversationId] });
      // Limpiar cualquier rastro restante del cache
      queryClient.removeQueries({ 
        queryKey: ["messages", conversationId],
        exact: false 
      });
    },
    onSettled: async (data, error, conversationId) => {
      console.log(`[useDeleteConversation] onSettled for ${conversationId}, error: ${!!error}`);
      // Forzar refetch para asegurar que todo esté sincronizado
      await queryClient.refetchQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      // Limpiar cualquier rastro restante
      queryClient.removeQueries({ queryKey: ["messages", conversationId] });
    },
  });
}

export function useRenameConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, title }: { conversationId: string; title: string }) =>
      renameConversation(conversationId, title),
    onMutate: async ({ conversationId, title }) => {
      await queryClient.cancelQueries({ queryKey: CONVERSATIONS_QUERY_KEY });

      const previousConversations = queryClient.getQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY);

      // Optimistic update - retornar nuevo array
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
        const updated = old.map((conv) => (conv.id === conversationId ? { ...conv, title } : conv));
        return [...updated]; // Nuevo array para forzar re-render
      });

      return { previousConversations };
    },
    onError: (err, variables, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, context.previousConversations);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}

