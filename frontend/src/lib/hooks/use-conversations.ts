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
    mutationFn: (conversationId: string) => deleteConversation(conversationId),
    onMutate: async (conversationId) => {
      // Cancelar queries en progreso para evitar sobrescribir el optimistic update
      await queryClient.cancelQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: ["messages", conversationId] });

      // Snapshot del valor anterior
      const previousConversations = queryClient.getQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY);

      // Optimistic update: remover la conversación inmediatamente
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) =>
        old.filter((conv) => conv.id !== conversationId)
      );

      // Remover queries de mensajes de esta conversación del cache
      queryClient.removeQueries({ queryKey: ["messages", conversationId] });

      return { previousConversations, conversationId };
    },
    onError: (err, conversationId, context) => {
      console.error("[useDeleteConversation] Error deleting conversation:", err);
      // Rollback en caso de error
      if (context?.previousConversations) {
        queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, context.previousConversations);
      }
    },
    onSuccess: () => {
      // Invalidar para asegurar sincronización (pero el optimistic update ya se aplicó)
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
    onSettled: () => {
      // Asegurar que todo esté sincronizado
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
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

