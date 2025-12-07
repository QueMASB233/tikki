import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchConversations, createConversation, deleteConversation, renameConversation, Conversation } from "@/lib/api-client";

const CONVERSATIONS_QUERY_KEY = ["conversations"];

export function useConversations() {
  return useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: async () => {
      console.log(`[useConversations] Fetching conversations from Supabase API...`);
      const startTime = Date.now();
      try {
        const conversations = await fetchConversations();
        const duration = Date.now() - startTime;
        console.log(`[useConversations] ✅ Fetched ${conversations.length} conversations from Supabase in ${duration}ms`);
        console.log(`[useConversations] Conversation IDs from Supabase: ${conversations.map(c => c.id).join(', ') || 'none'}`);
        return conversations;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[useConversations] ❌ Error fetching conversations after ${duration}ms:`, error);
        throw error;
      }
    },
    staleTime: 0, // Siempre considerar los datos como stale para forzar refetch
    gcTime: 0, // NO mantener en cache - siempre refetch desde Supabase
    refetchOnMount: true, // Refetch al montar el componente
    refetchOnWindowFocus: false, // No refetch al cambiar de ventana
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title?: string) => {
      console.log(`[useCreateConversation] Creating conversation with title: "${title || 'null'}"`);
      const startTime = Date.now();
      try {
        const newConversation = await createConversation(title);
        const duration = Date.now() - startTime;
        console.log(`[useCreateConversation] ✅ Conversation created in Supabase: ${newConversation.id} (${duration}ms)`);
        console.log(`[useCreateConversation] Conversation data:`, JSON.stringify(newConversation));
        return newConversation;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[useCreateConversation] ❌ Error creating conversation after ${duration}ms:`, error);
        throw error;
      }
    },
    onSuccess: async (newConversation) => {
      console.log(`[useCreateConversation] onSuccess: Adding conversation ${newConversation.id} to cache`);
      
      // Optimistic update: agregar la nueva conversación al inicio de la lista
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
        // Verificar que no exista ya (evitar duplicados)
        const exists = old.some(conv => conv.id === newConversation.id);
        if (exists) {
          console.log(`[useCreateConversation] Conversation ${newConversation.id} already in cache, updating`);
          return [...old.map(conv => conv.id === newConversation.id ? newConversation : conv)];
        }
        console.log(`[useCreateConversation] Adding to cache: ${old.length} -> ${old.length + 1}`);
        // Ordenar por updated_at descendente y retornar nuevo array
        const updated = [newConversation, ...old].sort((a, b) => 
          new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        );
        console.log(`[useCreateConversation] Updated conversation IDs: ${updated.map(c => c.id).join(', ')}`);
        return [...updated];
      });
      
      // Invalidar y refetch inmediatamente desde Supabase para sincronización
      console.log(`[useCreateConversation] Invalidating and refetching conversations from Supabase...`);
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      await queryClient.refetchQueries({ 
        queryKey: CONVERSATIONS_QUERY_KEY,
        type: 'active'
      });
      console.log(`[useCreateConversation] ✅ Conversations refetched from Supabase`);
    },
    onError: (error) => {
      console.error(`[useCreateConversation] ❌ Mutation failed:`, error);
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      console.log(`[useDeleteConversation] 🗑️ Deleting conversation ${conversationId} from Supabase...`);
      const startTime = Date.now();
      try {
        const result = await deleteConversation(conversationId);
        const duration = Date.now() - startTime;
        console.log(`[useDeleteConversation] ✅ Conversation ${conversationId} deleted from Supabase (${duration}ms)`);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[useDeleteConversation] ❌ Error deleting conversation ${conversationId} after ${duration}ms:`, error);
        throw error;
      }
    },
    onMutate: async (conversationId) => {
      console.log(`[useDeleteConversation] onMutate: Preparing optimistic update for ${conversationId}`);
      
      // Cancelar queries en progreso para evitar race conditions
      await queryClient.cancelQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: ["messages", conversationId] });

      // Snapshot del valor anterior para rollback
      const previousConversations = queryClient.getQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY);
      const previousCount = previousConversations?.length || 0;
      console.log(`[useDeleteConversation] Previous conversations count: ${previousCount}`);
      if (previousConversations && previousCount > 0) {
        console.log(`[useDeleteConversation] Previous conversation IDs: ${previousConversations.map(c => c.id).join(', ')}`);
      }

      // Optimistic update: remover la conversación inmediatamente del cache
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
        if (!old || old.length === 0) {
          console.log(`[useDeleteConversation] No conversations in cache, nothing to remove`);
          return [];
        }
        const filtered = old.filter((conv) => conv.id !== conversationId);
        console.log(`[useDeleteConversation] Optimistic update: ${old.length} -> ${filtered.length} conversations`);
        if (filtered.length > 0) {
          console.log(`[useDeleteConversation] Remaining conversation IDs: ${filtered.map(c => c.id).join(', ')}`);
        } else {
          console.log(`[useDeleteConversation] No conversations remaining after deletion`);
        }
        return [...filtered]; // Nuevo array para forzar re-render
      });

      // Limpiar queries de mensajes relacionados
      queryClient.removeQueries({ queryKey: ["messages", conversationId] });

      return { previousConversations, conversationId };
    },
    onError: (err, conversationId, context) => {
      console.error(`[useDeleteConversation] ❌ Error deleting conversation ${conversationId}:`, err);
      
      // Rollback: restaurar el estado anterior
      if (context?.previousConversations) {
        console.log(`[useDeleteConversation] 🔄 Rolling back to previous state`);
        queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, context.previousConversations);
        const restoredCount = context.previousConversations.length;
        console.log(`[useDeleteConversation] ✅ Rollback complete: ${restoredCount} conversations restored`);
      }
    },
    onSuccess: async (data, conversationId) => {
      console.log(`[useDeleteConversation] ✅ Successfully deleted conversation ${conversationId} from Supabase`);
      
      // Limpiar queries de mensajes relacionados
      queryClient.removeQueries({ queryKey: ["messages", conversationId] });
      
      // Asegurar que la conversación no esté en el cache (por si acaso)
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
        const filtered = old.filter((conv) => conv.id !== conversationId);
        if (filtered.length !== old.length) {
          console.log(`[useDeleteConversation] Removed conversation from cache: ${old.length} -> ${filtered.length}`);
        }
        return [...filtered];
      });
      
      // Invalidar y refetch desde Supabase para asegurar sincronización
      console.log(`[useDeleteConversation] Invalidating and refetching conversations from Supabase...`);
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      await queryClient.refetchQueries({ 
        queryKey: CONVERSATIONS_QUERY_KEY,
        type: 'active'
      });
      
      // Verificar que la conversación eliminada no esté en el cache después del refetch
      const afterRefetch = queryClient.getQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY);
      const stillExists = afterRefetch?.some(conv => conv.id === conversationId);
      if (stillExists) {
        console.error(`[useDeleteConversation] ⚠️ WARNING: Conversation ${conversationId} still in cache after refetch! Forcing removal...`);
        queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old = []) => {
          return old.filter((conv) => conv.id !== conversationId);
        });
      } else {
        const finalCount = afterRefetch?.length || 0;
        console.log(`[useDeleteConversation] ✅ Verified: Conversation ${conversationId} successfully removed. Final count: ${finalCount}`);
        if (finalCount > 0) {
          console.log(`[useDeleteConversation] Final conversation IDs: ${afterRefetch?.map(c => c.id).join(', ')}`);
        }
      }
    },
  });
}

export function useRenameConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, title }: { conversationId: string; title: string }) => {
      console.log(`[useRenameConversation] ✏️ Renaming conversation ${conversationId} to "${title}"`);
      const startTime = Date.now();
      try {
        const updated = await renameConversation(conversationId, title);
        const duration = Date.now() - startTime;
        console.log(`[useRenameConversation] ✅ Conversation ${conversationId} renamed in Supabase (${duration}ms)`);
        return updated;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[useRenameConversation] ❌ Error renaming conversation ${conversationId} after ${duration}ms:`, error);
        throw error;
      }
    },
    onMutate: async ({ conversationId, title }) => {
      console.log(`[useRenameConversation] onMutate: Preparing optimistic update for ${conversationId}`);
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
      console.error(`[useRenameConversation] ❌ Error renaming conversation ${variables.conversationId}:`, err);
      if (context?.previousConversations) {
        console.log(`[useRenameConversation] 🔄 Rolling back to previous state`);
        queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, context.previousConversations);
      }
    },
    onSuccess: async () => {
      console.log(`[useRenameConversation] ✅ Successfully renamed conversation, refreshing from Supabase...`);
      // Invalidar y refetch desde Supabase para asegurar sincronización
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      await queryClient.refetchQueries({ 
        queryKey: CONVERSATIONS_QUERY_KEY,
        type: 'active'
      });
      console.log(`[useRenameConversation] ✅ Conversations refreshed from Supabase`);
    },
  });
}

