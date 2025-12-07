"use client";

import { useState, useCallback, useMemo, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatHeader } from "@/components/chat/chat-header";
import { WelcomeScreen } from "@/components/chat/welcome-screen";
import { useAuth } from "@/lib/auth-context";
import { 
  detectTransformationKeyword, 
  triggerTransformation, 
  resetTransformationAfterResponse,
} from "@/lib/personality/transformation-mode";
import { TransformationFlash } from "@/components/animations/transformation-flash";
import { useSound } from "@/lib/sounds/sound-manager";
import { appConfig } from "@/lib/config";
import { useConversations, useDeleteConversation, useRenameConversation } from "@/lib/hooks/use-conversations";
import { useMessages } from "@/lib/hooks/use-messages";
import { useSendMessage } from "@/lib/hooks/use-send-message";
import { Message } from "@/lib/api-client";

function DashboardContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading, logout } = useAuth();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [transformationFlash, setTransformationFlash] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { playTransformation } = useSound();

  // React Query hooks - DEBEN estar antes de cualquier return condicional
  // ÚNICA fuente de verdad para conversaciones - viene directamente de Supabase
  const { data: conversations = [], isLoading: conversationsLoading, refetch: refetchConversations } = useConversations();
  
  // Debug: Log conversations changes desde Supabase
  useEffect(() => {
    console.log(`[DASHBOARD] 📊 Conversations updated from Supabase: ${conversations.length} conversations`);
    if (conversations.length > 0) {
      console.log(`[DASHBOARD] Conversation IDs from Supabase: ${conversations.map(c => c.id).join(', ')}`);
    } else {
      console.log(`[DASHBOARD] No conversations found in Supabase`);
    }
  }, [conversations]);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(currentConversationId);
  const deleteConversationMutation = useDeleteConversation();
  const renameConversationMutation = useRenameConversation();
  const sendMessageMutation = useSendMessage();

  const welcomeMessage = useMemo<Message>(
    () => ({
      id: "welcome-message",
      role: "assistant",
      content: `¡Hola! ✨ Soy tu compañera ${user?.full_name?.split(" ")[0] || "Amiga"}. Estoy aquí para acompañarte en tu día a día. ¿En qué puedo ayudarte hoy?`,
      created_at: new Date().toISOString()
    }),
    [user?.full_name]
  );

  // Redirigir a login si no hay usuario autenticado (después de los hooks)
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Determinar qué mensajes mostrar
  const displayMessages = useMemo(() => {
    // Si hay conversación activa y mensajes, mostrarlos
    if (currentConversationId && messages.length > 0) {
      return messages;
    }
    // Si hay conversación activa pero no hay mensajes aún (cargando o recién creada)
    if (currentConversationId && (sendMessageMutation.isPending || streamingMessageId)) {
      // Los mensajes temporales ya están en el cache de React Query
      return messages;
    }
    // Si no hay conversación activa, mostrar welcome
    if (!currentConversationId) {
      return [welcomeMessage];
    }
    return [welcomeMessage];
  }, [currentConversationId, messages, welcomeMessage, sendMessageMutation.isPending, streamingMessageId]);

  // Determinar si mostrar welcome screen
  const showWelcome = useMemo(() => {
    // No mostrar welcome si está enviando mensaje o hay stream activo
    if (sendMessageMutation.isPending || streamingMessageId) return false;
    // No mostrar welcome si hay conversación activa
    if (currentConversationId) return false;
    // Mostrar welcome solo si no hay conversación y no hay mensajes
    return true;
  }, [currentConversationId, sendMessageMutation.isPending, streamingMessageId]);

  const handleSend = useCallback(
    async (content: string) => {
      // Detectar y activar modo transformación
      if (detectTransformationKeyword(content)) {
        triggerTransformation();
        if (appConfig.enableSounds) {
          playTransformation();
        }
        if (appConfig.enableMagicAnimations) {
          setTransformationFlash(true);
          setTimeout(() => setTransformationFlash(false), 500);
        }
      }

      try {
        const result = await sendMessageMutation.mutateAsync({
          content,
          conversationId: currentConversationId,
          onCreateConversation: async (newConversationId) => {
            // Cuando se crea una nueva conversación, establecerla como activa
            // Esto hará que showWelcome cambie a false y muestre los mensajes
            console.log(`[DASHBOARD] ✅ New conversation created: ${newConversationId}`);
            console.log(`[DASHBOARD] Setting as current conversation and refreshing sidebar from Supabase...`);
            setCurrentConversationId(newConversationId);
            
            // El hook useSendMessage ya hizo el refetch, pero hacemos uno adicional
            // para asegurar que el sidebar se actualice inmediatamente
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            await queryClient.refetchQueries({ 
              queryKey: ["conversations"],
              type: 'active'
            });
            console.log(`[DASHBOARD] ✅ Sidebar refreshed from Supabase`);
          },
          onStreamingMessageId: (id) => {
            setStreamingMessageId(id);
          },
          onChunk: () => {
            // El hook ya maneja la actualización del mensaje en el cache
          },
        });

        // Resetear modo transformación después de la respuesta
        resetTransformationAfterResponse();
        setStreamingMessageId(null);
        
        // Asegurar que las conversaciones estén actualizadas después del stream
        // El hook ya invalida las conversaciones en onComplete, pero hacemos un refetch adicional
        // para asegurar que el sidebar esté sincronizado con Supabase
        console.log(`[DASHBOARD] Refreshing conversations from Supabase after message stream...`);
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        await queryClient.refetchQueries({ 
          queryKey: ["conversations"],
          type: 'active'
        });
        console.log(`[DASHBOARD] ✅ Conversations refreshed from Supabase`);
      } catch (error) {
        console.error("[DASHBOARD] Failed to send message:", error);
        setStreamingMessageId(null);
        // Si falla y no había conversación, limpiar el estado
        if (!currentConversationId) {
          // Los mensajes temporales ya fueron removidos por el hook en onError
        }
      }
    },
    [currentConversationId, sendMessageMutation, playTransformation, queryClient]
  );

  const handleNewConversation = useCallback(() => {
    // Solo limpiar la conversación actual y mostrar welcome screen
    setCurrentConversationId(null);
  }, []);

  const handleSelectConversation = useCallback((conversationId: string | null) => {
    setCurrentConversationId(conversationId);
    setIsMobileSidebarOpen(false);
  }, []);

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      console.log(`[DASHBOARD] 🗑️ handleDeleteConversation called for: ${conversationId}`);
      
      // Si estamos viendo esta conversación, redirigir al welcome inmediatamente
      if (currentConversationId === conversationId) {
        console.log(`[DASHBOARD] Deleting active conversation, redirecting to welcome`);
        setCurrentConversationId(null);
      }

      // El hook maneja el optimistic update y el refetch desde Supabase
      // Si falla, el hook hará rollback automáticamente
      deleteConversationMutation.mutate(conversationId, {
        onSuccess: () => {
          console.log(`[DASHBOARD] ✅ Conversation ${conversationId} deleted successfully from Supabase`);
          // Asegurar que no quede rastro
          if (currentConversationId === conversationId) {
            setCurrentConversationId(null);
          }
        },
        onError: (error) => {
          console.error(`[DASHBOARD] ❌ Failed to delete conversation ${conversationId}:`, error);
          // Aquí podrías mostrar un toast de error si implementas el sistema de toasts
        },
      });
    },
    [currentConversationId, deleteConversationMutation]
  );

  const handleRenameConversation = useCallback(
    (conversationId: string, newTitle: string) => {
      renameConversationMutation.mutate({ conversationId, title: newTitle });
    },
    [renameConversationMutation]
  );

  const handleLogout = useCallback(() => {
    logout();
    router.replace("/");
  }, [logout, router]);

  const chatLoading = sendMessageMutation.isPending || messagesLoading;

  return (
    <div className="flex h-screen bg-gradient-to-br from-white via-pink-50/30 to-white overflow-hidden max-w-full relative">
      {/* Transformation Flash */}
      <TransformationFlash trigger={transformationFlash} />
      
      {/* Sidebar */}
      <div 
        className={`
          fixed md:relative top-0 left-0 bottom-0 z-50 md:z-auto
          transition-transform duration-300 ease-in-out
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          md:block
        `}
      >
        <ChatSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          userName={user?.full_name}
        />
      </div>

      <div className="flex h-screen flex-1 flex-col overflow-hidden min-w-0 max-w-full relative">
        <ChatHeader 
          onLogout={handleLogout}
          onToggleSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        />
        
        {/* Mobile Sidebar Overlay */}
        <div
          className={`
            absolute inset-0 top-16 bg-black/50 z-40 md:hidden
            transition-opacity duration-300 ease-in-out
            ${isMobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
          onClick={() => setIsMobileSidebarOpen(false)}
        />
        
        {showWelcome ? (
          <div className="flex-1 overflow-hidden min-h-0 relative z-30">
            <WelcomeScreen userName={user?.full_name} onSend={handleSend} />
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-hidden relative z-30">
              <ChatMessageList 
                messages={displayMessages} 
                loading={chatLoading} 
                streamingMessageId={streamingMessageId}
              />
            </div>
            <div className="flex-shrink-0 relative z-30">
              <ChatInput onSend={handleSend} disabled={chatLoading} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">Cargando...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
