"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatHeader } from "@/components/chat/chat-header";
import { WelcomeScreen } from "@/components/chat/welcome-screen";
import {
  fetchMessages,
  fetchProfile,
  fetchConversations,
  createConversation,
  Message,
  Conversation,
  sendMessage,
  sendMessageStream,
  setAuthToken,
  deleteConversation,
  renameConversation,
  updateProfile
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { 
  detectTransformationKeyword, 
  triggerTransformation, 
  resetTransformationAfterResponse,
  isTransformationModeActive 
} from "@/lib/personality/transformation-mode";
import { TransformationFlash } from "@/components/animations/transformation-flash";
import { useSound } from "@/lib/sounds/sound-manager";
import { appConfig } from "@/lib/config";

function DashboardContent() {
  const router = useRouter();
  const { user, loading, logout, setUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [transformationFlash, setTransformationFlash] = useState(false);
  const { playTransformation } = useSound();

  const welcomeMessage = useMemo<Message>(
    () => ({
      id: "welcome-message",
      role: "assistant",
      content:
        `¡Hola! ✨ Soy tu compañera ${user?.full_name?.split(" ")[0] || "Amiga"}. Estoy aquí para acompañarte en tu día a día. ¿En qué puedo ayudarte hoy?`,
      created_at: new Date().toISOString()
    }),
    [user?.full_name]
  );

  // Redirigir a login si no hay usuario autenticado
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("es_token")
        : undefined;
    if (token) {
      setAuthToken(token);
    }
  }, []);


  useEffect(() => {
    if (!user || initialized) return;
    const loadData = async () => {
      try {
        // Asegurar que el token esté cargado
        const token = typeof window !== "undefined" ? localStorage.getItem("es_token") : null;
        if (token) {
          setAuthToken(token);
        }
        
        const [convs, history] = await Promise.all([
          fetchConversations(),
          currentConversationId ? fetchMessages(currentConversationId) : Promise.resolve([])
        ]);
        setConversations(convs);
        if (currentConversationId && history.length > 0) {
          setMessages(history);
        } else {
          setMessages([welcomeMessage]);
        }
      } catch (error) {
        console.error("Failed to load data", error);
        setMessages([welcomeMessage]);
      } finally {
        setInitialized(true);
      }
    };
    loadData();
  }, [initialized, user, welcomeMessage]);
  
  // Cargar mensajes cuando cambia la conversación activa (separado para mejor rendimiento)
  useEffect(() => {
    if (!currentConversationId || !initialized) {
      if (!currentConversationId) {
        setMessages([welcomeMessage]);
      }
      return;
    }
    
    const loadMessages = async () => {
      try {
        const history = await fetchMessages(currentConversationId);
        if (history.length > 0) {
          setMessages(history);
        } else {
          setMessages([welcomeMessage]);
        }
      } catch (error) {
        console.error("Failed to load messages", error);
        setMessages([welcomeMessage]);
      }
    };
    
    loadMessages();
  }, [currentConversationId, initialized, welcomeMessage]);

  const handleSend = useCallback(
    async (content: string) => {
      console.log(`[DASHBOARD] handleSend called with content length: ${content.length}, currentConversationId: ${currentConversationId || 'null'}`);
      let conversationId = currentConversationId;

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

      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        content,
        role: "user",
        created_at: new Date().toISOString()
      };

      // Crear mensaje temporal del asistente para typewriter
      const tempAssistantId = `temp-assistant-${Date.now()}`;
      const tempAssistantMessage: Message = {
        id: tempAssistantId,
        content: "",
        role: "assistant",
        created_at: new Date().toISOString()
      };

      setMessages((prev) => {
        // Filtrar mensajes temporales y welcome, asegurando que solo haya un mensaje del asistente
        const filtered = prev.filter(
          (message) =>
            !message.id.startsWith("temp-user-") &&
            !message.id.startsWith("temp-assistant-") &&
            message.id !== "welcome-message"
        );
        return [...filtered, userMessage, tempAssistantMessage];
      });
      setChatLoading(true); // Mantener loading mientras se procesa
      setStreamingMessageId(tempAssistantId);

      try {
        // Si no hay conversación, crear una primero (no usar ID temporal)
        let finalConversationId = conversationId;
        if (!finalConversationId) {
          console.log(`[DASHBOARD] No conversation ID, creating new conversation`);
          try {
            const title = content.length > 50 ? content.substring(0, 50) + "..." : content;
            console.log(`[DASHBOARD] Creating conversation with title: "${title}"`);
            const newConv = await createConversation(title);
            console.log(`[DASHBOARD] Conversation created: ${newConv.id}`);
            finalConversationId = newConv.id;
            setCurrentConversationId(newConv.id);
            // Actualizar sidebar inmediatamente
            setConversations((prev) => [newConv, ...prev]);
            console.log(`[DASHBOARD] Updated currentConversationId to: ${newConv.id}`);
            // Asegurar que se muestre la vista de chat (no welcome) después de crear conversación
            // Esto se maneja automáticamente porque ahora hay currentConversationId
          } catch (error) {
            console.error(`[DASHBOARD] Failed to create conversation:`, error);
            throw error;
          }
        } else {
          console.log(`[DASHBOARD] Using existing conversation: ${finalConversationId}`);
        }
        
        await sendMessageStream(
          content,
          finalConversationId,
          // onChunk: actualizar el mensaje temporal con cada chunk (sin scroll)
          (chunk: string) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempAssistantId
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
            );
            // NO hacer scroll durante el streaming
          },
          // onComplete: reemplazar el mensaje temporal con el real
          (messageId: string, completedConversationId: string) => {
            console.log(`[DASHBOARD] Stream onComplete called:`, { 
              messageId, 
              completedConversationId, 
              finalConversationId 
            });
            setStreamingMessageId(null);
            setChatLoading(false);
            
            // Resetear modo transformación después de la respuesta
            resetTransformationAfterResponse();
            
            // Recargar todos los mensajes de la conversación para asegurar sincronización
            if (finalConversationId) {
              console.log(`[DASHBOARD] Fetching messages and conversations for: ${finalConversationId}`);
              Promise.all([
                fetchMessages(finalConversationId),
                fetchConversations()
              ])
                .then(([msgs, convs]) => {
                  console.log(`[DASHBOARD] Fetched ${msgs?.length || 0} messages and ${convs?.length || 0} conversations`);
                  // Actualizar conversaciones
                  setConversations(convs);
                  // Reemplazar todos los mensajes con los reales de la BD
                  // Si hay mensajes, usarlos; si no, mantener los temporales pero limpiar el welcome
                  if (msgs && msgs.length > 0) {
                    console.log(`[DASHBOARD] Setting ${msgs.length} messages from database`);
                    setMessages(msgs);
                  } else {
                    console.warn(`[DASHBOARD] No messages found in database, keeping temporary messages`);
                    // Si no hay mensajes en BD, mantener los temporales pero limpiar el welcome
                    setMessages((prev) => 
                      prev.filter(msg => msg.id !== "welcome-message")
                    );
                  }
                })
                .catch((err) => {
                  console.error(`[DASHBOARD] Error fetching data after stream:`, err);
                  console.error(`[DASHBOARD] Error details:`, JSON.stringify(err, null, 2));
                  // Actualizar conversaciones aunque falle el fetch de mensajes
                  fetchConversations()
                    .then(setConversations)
                    .catch((e) => console.error(`[DASHBOARD] Error fetching conversations:`, e));
                  // Mantener los mensajes temporales si falla el fetch
                  setMessages((prev) => 
                    prev.filter(msg => msg.id !== "welcome-message")
                  );
                });
            } else {
              console.warn(`[DASHBOARD] No finalConversationId, only fetching conversations`);
              // Si no hay conversationId, solo actualizar conversaciones
              fetchConversations()
                .then(setConversations)
                .catch((err) => console.error(`[DASHBOARD] Error fetching conversations:`, err));
            }
          },
          // onError
          (error: string) => {
            console.error(`[DASHBOARD] Stream onError called:`, error);
            setStreamingMessageId(null);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempAssistantId
                  ? { ...msg, content: msg.content || `Error: ${error}` }
                  : msg
              )
            );
            setChatLoading(false);
          }
        );
      } catch (error) {
        console.error(`[DASHBOARD] Failed to send message:`, error);
        console.error(`[DASHBOARD] Error details:`, JSON.stringify(error, null, 2));
        setMessages((prev) =>
          prev.filter(
            (message) =>
              !message.id.startsWith("temp-user-") &&
              !message.id.startsWith("temp-assistant-")
          )
        );
        setChatLoading(false);
        throw error;
      }
    },
    [currentConversationId, playTransformation]
  );

  const handleLogout = () => {
    logout();
    router.replace("/");
  };

  const handleNewConversation = () => {
    // Solo limpiar la conversación actual y mostrar welcome screen
    // NO crear una nueva conversación - esto solo se hace desde welcome-screen
    setCurrentConversationId(null);
    setMessages([welcomeMessage]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectConversation = (conversationId: string | null) => {
    setCurrentConversationId(conversationId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteConversation = async (conversationId: string) => {
    // Optimistic update - eliminar inmediatamente
    setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));
    if (currentConversationId === conversationId) {
      setCurrentConversationId(null);
      setMessages([welcomeMessage]);
    }

    // Eliminar en el backend (sin esperar)
    deleteConversation(conversationId).catch((error) => {
      console.error("Failed to delete conversation", error);
      // Recargar conversaciones si falla
      fetchConversations()
        .then(setConversations)
        .catch((err) => console.error("Error fetching conversations:", err));
    });
  };

  const handleRenameConversation = async (conversationId: string, newTitle: string) => {
    // Guardar estado anterior para rollback
    const previousConversations = [...conversations];

    // Actualización optimista
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, title: newTitle } : c))
    );

    try {
      await renameConversation(conversationId, newTitle);
    } catch (error) {
      console.error("Failed to rename conversation", error);
      // Rollback en caso de error
      setConversations(previousConversations);
    }
  };

  // Determinar si mostrar pantalla de bienvenida
  const showWelcome = useMemo(() => {
    // No mostrar welcome si está cargando o hay un stream activo
    if (chatLoading || streamingMessageId) return false;
    // Si hay conversación activa, no mostrar welcome
    if (currentConversationId) return false;
    // Si hay mensajes reales (no temporales ni welcome), no mostrar welcome
    const hasRealMessages = messages.some(
      (msg) => !msg.id.startsWith("temp-") && msg.id !== "welcome-message"
    );
    if (hasRealMessages) return false;
    // Si hay mensajes temporales, no mostrar welcome
    const hasTempMessages = messages.some((msg) => msg.id.startsWith("temp-"));
    if (hasTempMessages) return false;
    // Mostrar welcome solo si no hay conversación activa y no hay mensajes
    return true;
  }, [messages, chatLoading, streamingMessageId, currentConversationId]);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
          onSelectConversation={(id) => {
            handleSelectConversation(id);
            setIsMobileSidebarOpen(false);
          }}
          onNewConversation={() => {
            handleNewConversation();
            setIsMobileSidebarOpen(false);
          }}
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
        
        {/* Mobile Sidebar Overlay - Solo cubre el contenido, no el header */}
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
                messages={messages} 
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

