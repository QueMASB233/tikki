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

  // Detectar cuando se agrega un nuevo mensaje del usuario y hacer scroll
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    
    // Si el último mensaje es del usuario y es diferente al anterior, hacer scroll
    if (lastMessage.role === "user" && lastMessage.id !== lastUserMessageId.current) {
      lastUserMessageId.current = lastMessage.id;
      
      // Scroll inmediato cuando se envía un mensaje del usuario
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (bottomRef.current && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        });
      });
    }

    lastMessageCount.current = messages.length;
  }, [messages]);

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
      className="h-full overflow-y-auto bg-brand-light px-3 sm:px-4 pb-4 sm:pb-6 pt-4 sm:pt-10 scrollbar-thin"
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white">
              ES
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="text-slate-400 animate-pulse">
                Razonando para darte una mejor respuesta...
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} data-scroll-bottom />
      </div>
    </div>
  );
}




