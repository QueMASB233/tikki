"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/lib/api-client";
import { ChatMessageItem } from "./chat-message-item";

interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
  streamingMessageId?: string | null;
  scrollToBottom?: boolean; // Nueva prop para controlar el scroll
}

export function ChatMessageList({ messages, loading, streamingMessageId, scrollToBottom }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastMessageCount = useRef<number>(0);
  const lastUserMessageId = useRef<string | null>(null);

  // Scroll automático cuando cambian los mensajes o hay streaming
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const lastMessage = messages[messages.length - 1];
    
    // Detectar si hay un nuevo mensaje o si el contenido de un mensaje cambió (streaming)
    const hasNewMessage = messages.length !== lastMessageCount.current;
    const isStreaming = streamingMessageId && lastMessage?.id === streamingMessageId;
    
    if (hasNewMessage || isStreaming) {
      // Calcular si el usuario está cerca del final (dentro de 100px)
      const isNearBottom = 
        container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      
      // Solo hacer scroll si está cerca del final o es un nuevo mensaje del usuario
      if (isNearBottom || lastMessage?.role === "user") {
        requestAnimationFrame(() => {
          if (container && bottomRef.current) {
            container.scrollTop = container.scrollHeight;
          }
        });
      }
    }

    lastMessageCount.current = messages.length;
  }, [messages, streamingMessageId]);

  // Scroll cuando se solicita explícitamente
  useEffect(() => {
    if (scrollToBottom && bottomRef.current) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }, [scrollToBottom]);

  return (
    <div 
      ref={containerRef}
      className="h-full overflow-y-auto bg-gradient-to-b from-white via-pink-50/20 to-white px-3 sm:px-4 pb-4 sm:pb-6 pt-4 sm:pt-10 scrollbar-thin"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 sm:gap-3">
        {messages.map((message) => (
          <ChatMessageItem 
            key={message.id} 
            message={message} 
            isStreaming={streamingMessageId === message.id}
          />
        ))}
        {/* Solo mostrar loading si no hay un mensaje del asistente en streaming */}
        {loading && !streamingMessageId && (
          <div className="flex items-center justify-start gap-4 rounded-2xl px-6 py-5">
            <div className="relative">
              <div className="absolute inset-0 bg-ladybug-gradient rounded-full blur-md opacity-50"></div>
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-ladybug-gradient text-sm font-bold text-white shadow-ladybug">
                ✨
              </div>
            </div>
            <div className="rounded-2xl border-2 border-ladybug-pink/30 bg-white/90 backdrop-blur-sm px-5 py-4 shadow-ladybug">
              <div className="text-ladybug-pink animate-pulse font-semibold">
                ✨ Razonando para darte una mejor respuesta...
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} data-scroll-bottom />
      </div>
    </div>
  );
}




