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
          return [...old.map(conv => conv.id === newConversation.id ? newConversation : conv)];
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
      
      // Cancelar TODOS los queries en progreso relacionados
      await queryClient.cancelQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: ["messages", conversationId] });
      await queryClient.cancelQueries({ queryKey: ["messages"] }); // Cancelar todos los queries de mensajes

      // Snapshot del valor anterior
      const previousConversations = queryClient.getQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY);
      console.log(`[useDeleteConversation] Previous conversations count: ${previousConversations?.length || 0}`);
      if (previousConversations) {
        console.log(`[useDeleteConversation] Previous conversation IDs: ${previousConversations.map(c => c.id).join(', ')}`);
      }

      // Optimistic update: remover la conversación inmediatamente
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
        if (!old || old.length === 0) {
          console.log(`[useDeleteConversation] No conversations in cache`);
          return [];
        }
        const filtered = old.filter((conv) => conv.id !== conversationId);
        console.log(`[useDeleteConversation] Optimistic update: ${old.length} -> ${filtered.length} conversations`);
        console.log(`[useDeleteConversation] Remaining conversation IDs: ${filtered.map(c => c.id).join(', ')}`);
        
        // Verificar que realmente se removió
        const stillExists = filtered.some(conv => conv.id === conversationId);
        if (stillExists) {
          console.error(`[useDeleteConversation] ERROR: Conversation ${conversationId} still in filtered array!`);
          // Forzar eliminación
          return filtered.filter(conv => conv.id !== conversationId);
        }
        
        // Retornar nuevo array para forzar re-render
        return [...filtered];
      });

      // LIMPIAR COMPLETAMENTE todos los queries relacionados con esta conversación
      // Remover queries de mensajes (exact match)
      queryClient.removeQueries({ queryKey: ["messages", conversationId], exact: true });
      // Remover queries de mensajes (partial match - cualquier query que incluya este conversationId)
      queryClient.removeQueries({ queryKey: ["messages", conversationId], exact: false });
      // Remover cualquier query que contenga este conversationId
      queryClient.getQueryCache().getAll().forEach(query => {
        const queryKey = query.queryKey;
        if (Array.isArray(queryKey) && queryKey.includes(conversationId)) {
          console.log(`[useDeleteConversation] Removing query with key:`, queryKey);
          queryClient.removeQueries({ queryKey });
        }
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
      
      // LIMPIAR COMPLETAMENTE todo el cache relacionado
      // 1. Remover queries de mensajes
      queryClient.removeQueries({ queryKey: ["messages", conversationId], exact: true });
      queryClient.removeQueries({ queryKey: ["messages", conversationId], exact: false });
      
      // 2. Asegurar que la conversación no esté en el cache de conversaciones
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
        const filtered = old.filter((conv) => conv.id !== conversationId);
        if (filtered.length !== old.length) {
          console.log(`[useDeleteConversation] Removed conversation from cache: ${old.length} -> ${filtered.length}`);
        }
        return [...filtered];
      });
      
      // 3. Limpiar cualquier query que contenga este conversationId
      queryClient.getQueryCache().getAll().forEach(query => {
        const queryKey = query.queryKey;
        if (Array.isArray(queryKey) && queryKey.includes(conversationId)) {
          console.log(`[useDeleteConversation] Removing remaining query with key:`, queryKey);
          queryClient.removeQueries({ queryKey });
        }
      });
      
      // 4. Forzar refetch inmediato para sincronizar con backend
      // Pero filtrar la conversación eliminada si todavía aparece
      console.log(`[useDeleteConversation] Forcing immediate refetch to sync with backend`);
      await queryClient.refetchQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      
      // 5. Verificar después del refetch que no esté en el cache
      const afterRefetch = queryClient.getQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY);
      const stillExists = afterRefetch?.some(conv => conv.id === conversationId);
      if (stillExists) {
        console.error(`[useDeleteConversation] ERROR: Conversation ${conversationId} still in cache after refetch! Forcing removal...`);
        queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
          return old.filter((conv) => conv.id !== conversationId);
        });
      } else {
        console.log(`[useDeleteConversation] Verified: Conversation ${conversationId} successfully removed from cache`);
      }
    },
    onSettled: async (data, error, conversationId) => {
      console.log(`[useDeleteConversation] onSettled for ${conversationId}, error: ${!!error}`);
      
      // Limpiar cualquier rastro restante
      queryClient.removeQueries({ queryKey: ["messages", conversationId], exact: true });
      queryClient.removeQueries({ queryKey: ["messages", conversationId], exact: false });
      
      // Asegurar que la conversación no esté en el cache
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
        return old.filter((conv) => conv.id !== conversationId);
      });
      
      // Si hubo error, hacer refetch para rollback
      if (error) {
        console.log(`[useDeleteConversation] Error occurred, refetching to sync state`);
        await queryClient.refetchQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      }
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

