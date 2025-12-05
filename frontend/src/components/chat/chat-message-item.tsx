"use client";

import React from "react";
import clsx from "clsx";
import { Message } from "@/lib/api-client";

interface ChatMessageItemProps {
  message: Message;
  isStreaming?: boolean;
}

// Función simple para renderizar markdown básico
function renderMarkdown(text: string) {
  if (!text || !text.trim()) return null;
  
  // Limpiar el texto de espacios al final
  const cleanedText = text.trimEnd();
  
  // Dividir por líneas
  const lines = cleanedText.split('\n');
  const elements: React.ReactNode[] = [];
  
  lines.forEach((line, lineIndex) => {
    // Saltar líneas vacías al final
    if (line.trim() === '' && lineIndex === lines.length - 1) {
      return;
    }
    
    if (line.trim() === '') {
      elements.push(<br key={`br-${lineIndex}`} />);
      return;
    }
    
    // Procesar negritas **texto**
    const parts: React.ReactNode[] = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    let keyCounter = 0;
    
    while ((match = boldRegex.exec(line)) !== null) {
      // Texto antes del match
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }
      // Texto en negrita
      parts.push(
        <strong key={`bold-${lineIndex}-${keyCounter++}`} className="font-semibold">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    
    // Texto restante
    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }
    
    // Si no hubo matches, usar el texto original
    if (parts.length === 0) {
      parts.push(line);
    }
    
    elements.push(
      <p key={`line-${lineIndex}`} className="mb-2 last:mb-0">
        {parts}
      </p>
    );
  });
  
  if (elements.length === 0) return null;
  
  return <div>{elements}</div>;
}

export function ChatMessageItem({ message, isStreaming = false }: ChatMessageItemProps) {
  if (message.role === "system") {
    return null;
  }

  const isUser = message.role === "user";
  
  // Limpiar el contenido de espacios y caracteres extraños al final
  const cleanContent = message.content?.trimEnd() || "";

  return (
    <div
      className={clsx(
        "flex w-full gap-2 sm:gap-4 rounded-xl sm:rounded-2xl px-3 sm:px-6 py-3 sm:py-5 transition hover:bg-slate-50",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-brand-primary text-xs sm:text-sm font-semibold text-white flex-shrink-0">
          ES
        </div>
      )}
      <div
        className={clsx(
          "max-w-[85%] sm:max-w-3xl rounded-xl sm:rounded-2xl border px-3 sm:px-5 py-3 sm:py-4 text-sm leading-relaxed shadow-sm",
          isUser
            ? "border-brand-primary/20 bg-brand-primary/10 text-brand-dark whitespace-pre-wrap break-words"
            : "border-slate-200 bg-white text-slate-700 break-words"
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{cleanContent}</div>
        ) : (
          <div>
            {cleanContent ? (
              <>
                {renderMarkdown(cleanContent)}
                {isStreaming && (
                  <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-brand-primary" aria-hidden="true"></span>
                )}
              </>
            ) : isStreaming ? (
              <div className="text-slate-400 animate-pulse">
                Razonando para darte una mejor respuesta...
              </div>
            ) : null}
          </div>
        )}
        <div className="mt-2 text-right text-xs text-slate-400">
          {new Date(message.created_at).toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </div>
      </div>
    </div>
  );
}
