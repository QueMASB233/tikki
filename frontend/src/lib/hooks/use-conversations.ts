import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchConversations, createConversation, deleteConversation, renameConversation, Conversation } from "@/lib/api-client";

const CONVERSATIONS_QUERY_KEY = ["conversations"];

export function useConversations() {
  return useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: fetchConversations,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => createConversation(title),
    onSuccess: (newConversation) => {
      // Optimistic update: agregar la nueva conversación al inicio de la lista
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => [
        newConversation,
        ...old,
      ]);
      // Invalidar para refetch en background
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
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
        return filtered;
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
    onSuccess: (data, conversationId) => {
      console.log(`[useDeleteConversation] Successfully deleted conversation ${conversationId}`);
      // Invalidar para asegurar sincronización (pero el optimistic update ya se aplicó)
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      // Asegurar que los mensajes también se limpien
      queryClient.removeQueries({ queryKey: ["messages", conversationId] });
    },
    onSettled: (data, error, conversationId) => {
      console.log(`[useDeleteConversation] onSettled for ${conversationId}, error: ${!!error}`);
      // Asegurar que todo esté sincronizado
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
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

      // Optimistic update
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) =>
        old.map((conv) => (conv.id === conversationId ? { ...conv, title } : conv))
      );

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

