"use client";

import { useState, useRef, useEffect } from "react";
import { Conversation } from "@/lib/api-client";
import { Trash2, MessageSquare } from "lucide-react";
import clsx from "clsx";
import { AnimatedTitle } from "./animated-title";

interface SwipeableConversationProps {
  conv: Conversation;
  currentConversationId: string | null;
  isCollapsed: boolean;
  editingId: string | null;
  editTitle: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onSelect: (id: string) => void;
  onStartRename: (conv: Conversation) => void;
  onFinishRename: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDelete: (id: string) => void;
  index: number;
  onEditTitleChange: (value: string) => void;
}

export function SwipeableConversation({
  conv,
  currentConversationId,
  isCollapsed,
  editingId,
  editTitle,
  inputRef,
  onSelect,
  onStartRename,
  onFinishRename,
  onKeyDown,
  onDelete,
  index,
  onEditTitleChange,
}: SwipeableConversationProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [startX, setStartX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const DELETE_THRESHOLD = 80; // Píxeles necesarios para activar eliminación

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isCollapsed || editingId === conv.id) return; // No permitir swipe mientras se edita
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || isCollapsed) return;
    const currentX = e.touches[0].clientX;
    const diff = startX - currentX;
    
    // Solo permitir swipe hacia la izquierda (eliminar)
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, DELETE_THRESHOLD * 1.5));
    } else {
      setSwipeOffset(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping || isCollapsed) return;
    setIsSwiping(false);
    
    if (swipeOffset >= DELETE_THRESHOLD) {
      // Eliminar conversación
      onDelete(conv.id);
      setSwipeOffset(0);
    } else {
      // Volver a la posición original
      setSwipeOffset(0);
    }
  };

  // Resetear swipe cuando cambia la conversación activa
  useEffect(() => {
    if (currentConversationId !== conv.id) {
      setSwipeOffset(0);
    }
  }, [currentConversationId, conv.id]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Botón de eliminar (se muestra cuando se hace swipe) */}
      <div
        className={clsx(
          "absolute right-0 top-0 h-full flex items-center justify-center bg-red-500 transition-all duration-200 z-10",
          swipeOffset > 0 ? "w-20 opacity-100" : "w-0 opacity-0"
        )}
      >
        <Trash2 size={20} className="text-white" />
      </div>

      {/* Contenedor de la conversación */}
      <div
        className={clsx(
          "group relative flex cursor-pointer items-center rounded-xl transition-all duration-200 animate-fade-in",
          currentConversationId === conv.id
            ? "bg-primary text-white border border-primary"
            : "bg-white border border-transparent hover:bg-gray-50 hover:border-border",
          isCollapsed ? "justify-center p-2" : "p-3",
          isSwiping && "transition-none"
        )}
        style={{
          animationDelay: `${index * 50}ms`,
          transform: `translateX(-${swipeOffset}px)`,
        }}
        onClick={() => {
          if (swipeOffset === 0) {
            onSelect(conv.id);
          }
        }}
      >
        {isCollapsed ? (
          <MessageSquare size={18} className={currentConversationId === conv.id ? "text-white" : "text-text-light"} />
        ) : (
          <div className="min-w-0 flex-1">
                  {editingId === conv.id ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => onEditTitleChange(e.target.value)}
                      onBlur={onFinishRename}
                      onKeyDown={onKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="w-full rounded border border-primary px-1 py-0.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  ) : (
              <AnimatedTitle
                text={conv.title || "Sin título"}
                className={clsx(
                  "line-clamp-2 font-semibold",
                  currentConversationId === conv.id ? "text-white" : "text-text"
                )}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onStartRename(conv);
                }}
                title={conv.title || "Sin título"}
              />
            )}
            <p className={clsx(
              "mt-1 text-[10px] font-medium",
              currentConversationId === conv.id ? "text-white/80" : "text-text-light"
            )}>
              {new Date(conv.updated_at).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>
        )}
        {!isCollapsed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(conv.id);
            }}
            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 text-red-500"
            title="Eliminar conversación"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

