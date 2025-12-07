"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { Message } from "@/lib/api-client";
import { BotAvatarGlow } from "@/components/animations/bot-avatar-glow";
import { useSound } from "@/lib/sounds/sound-manager";
import { appConfig } from "@/lib/config";
import { useAuth } from "@/lib/auth-context";

interface ChatMessageItemProps {
  message: Message;
  isStreaming?: boolean;
}

const COMFORT_PHRASES = [
  "¡Tú puedes con todo, {name}!",
  "Eres mágica, {name}",
  "¡Sigue brillando, {name}!",
  "Confío en ti, {name}",
  "Hoy será un gran día, {name}",
  "¡Eres increíble, {name}!",
  "¡Transformación, {name}!",
  "Tu luz es única, {name}",
  "¡No te rindas, {name}!",
  "Estoy contigo, {name} ❤️"
];

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
  const { playReceive } = useSound();
  const { user } = useAuth();
  const [showPhrase, setShowPhrase] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState("");
  const [isClicking, setIsClicking] = useState(false);
  
  const isUser = message.role === "user";
  
  // Limpiar el contenido de espacios y caracteres extraños al final
  const cleanContent = message.content?.trimEnd() || "";

  // Reproducir sonido cuando llega una respuesta del bot (solo la primera vez)
  // Este hook debe estar antes de cualquier return condicional
  useEffect(() => {
    if (!isUser && cleanContent && appConfig.enableSounds && !isStreaming) {
      // Pequeño delay para que se sienta natural
      const timer = setTimeout(() => {
        playReceive();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [message.id, isUser, cleanContent, isStreaming, playReceive]);

  if (message.role === "system") {
    return null;
  }

  const handleAvatarClick = () => {
    if (isUser) return;
    
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 200);

    // Seleccionar frase aleatoria
    const randomPhrase = COMFORT_PHRASES[Math.floor(Math.random() * COMFORT_PHRASES.length)];
    // Reemplazar {name} con el nombre del usuario
    const userName = user?.full_name?.split(" ")[0] || "Amiga";
    const personalizedPhrase = randomPhrase.replace("{name}", userName);
    
    setCurrentPhrase(personalizedPhrase);
    setShowPhrase(true);

    // Ocultar la frase después de unos segundos
    setTimeout(() => {
      setShowPhrase(false);
    }, 4000);
  };

  return (
    <div
      className={clsx(
        "flex w-full gap-2 sm:gap-4 rounded-xl sm:rounded-2xl px-3 sm:px-6 py-3 sm:py-5 transition-all",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="relative flex-shrink-0 group">
          {/* Mensaje Mágico Flotante */}
          <div 
            className={clsx(
              "absolute bottom-full left-0 mb-2 p-2 bg-white/95 backdrop-blur-sm border border-[#ff0000]/20 rounded-xl shadow-lg transition-all duration-500 transform origin-bottom-left z-50 w-40",
              showPhrase 
                ? "opacity-100 scale-100 translate-y-0" 
                : "opacity-0 scale-90 translate-y-4 pointer-events-none"
            )}
          >
            <p className="text-xs font-medium text-[#ff0000] text-center leading-tight">
              {currentPhrase}
            </p>
            <div className="absolute bottom-[-5px] left-4 w-2.5 h-2.5 bg-white border-b border-r border-[#ff0000]/20 transform rotate-45"></div>
          </div>

          <div 
            onClick={handleAvatarClick}
            className={clsx(
              "cursor-pointer transition-transform duration-200",
              isClicking ? "scale-90" : "hover:scale-105"
            )}
          >
            <BotAvatarGlow isActive={isStreaming}>
              <div className="relative">
                {isStreaming && (
                  <>
                    <svg className="absolute -top-1 -right-1 w-3 h-3 text-[#ff0000] animate-[bounce_1.5s_infinite] opacity-80" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                    </svg>
                    <svg className="absolute -bottom-1 -left-1 w-2.5 h-2.5 text-[#ff0000] animate-[bounce_2s_infinite] opacity-60" viewBox="0 0 24 24" fill="currentColor" style={{ animationDelay: '0.3s' }}>
                      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                    </svg>
                    <svg className="absolute top-1/2 -left-2 w-2 h-2 text-[#ff0000] animate-[pulse_1s_infinite] opacity-50" viewBox="0 0 24 24" fill="currentColor" style={{ animationDelay: '0.15s' }}>
                      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                    </svg>
                  </>
                )}
                <img
                  src="https://storage.googleapis.com/msgsndr/j0pWZqREKZB05ljkLiO4/media/6935b0db81eaa180750cbc0d.png"
                  alt="Kwami"
                  className="h-9 w-9 sm:h-11 sm:w-11 object-contain relative z-10 rounded-full border border-pink-100 bg-white shadow-sm"
                />
              </div>
            </BotAvatarGlow>
          </div>
        </div>
      )}
      <div
        className={clsx(
          "max-w-[85%] sm:max-w-3xl rounded-lg border px-3 sm:px-5 py-3 sm:py-4 text-sm leading-relaxed shadow-minimal transition-all",
          isUser
            ? "border-primary bg-primary text-white whitespace-pre-wrap break-words"
            : "border-border bg-white text-text break-words"
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap font-medium">{cleanContent}</div>
        ) : (
          <div>
            {cleanContent ? (
              <>
                {renderMarkdown(cleanContent)}
                {isStreaming && (
                  <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-primary" aria-hidden="true"></span>
                )}
              </>
            ) : isStreaming ? (
              <div className="text-text-light animate-pulse font-medium">
                Razonando para darte una mejor respuesta...
              </div>
            ) : null}
          </div>
        )}
        <div className={clsx(
          "mt-2 text-right text-xs font-medium",
          isUser ? "text-white/80" : "text-text-light"
        )}>
          {new Date(message.created_at).toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </div>
      </div>
    </div>
  );
}
