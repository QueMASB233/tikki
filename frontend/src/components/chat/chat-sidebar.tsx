"use client";

import { useState, useEffect, useRef } from "react";
import { Conversation } from "@/lib/api-client";
import { Trash2, PanelLeftClose, PanelLeftOpen, MessageSquare, Plus } from "lucide-react";
import clsx from "clsx";
import { AnimatedTitle } from "./animated-title";

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, newTitle: string) => void;
  onCloseMobile?: () => void;
  userName?: string; // Nuevo prop
}

export function ChatSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onCloseMobile,
  userName, // Usar
}: ChatSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  const handleStartRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title || "");
  };

  const handleFinishRename = () => {
    if (editingId && editTitle.trim()) {
      onRenameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishRename();
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  return (
      <aside
        className={clsx(
          "h-full flex flex-col border-r border-border bg-white transition-all duration-300 w-full",
          isCollapsed ? "w-20 px-2 py-6" : "w-72 px-4 py-6"
        )}
      >
      <div className={clsx("mb-6 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
        <img
          src="https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/i/d14ea819-bcbe-49dc-99b9-e81086106809/dfrh2ua-b7109a51-d4a9-4ad3-a296-5080c8f2c81d.png"
          alt="Ladybug"
          className="h-8 w-8 object-contain"
        />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{userName || "Usuario"}</p>
              <p className="truncate text-xs text-text-light font-normal">Activo</p>
            </div>
        </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            // En móvil, cerrar completamente el sidebar
            if (onCloseMobile && window.innerWidth < 768) {
              onCloseMobile();
            } else {
              // En desktop, colapsar/expandir
              setIsCollapsed(!isCollapsed);
            }
          }}
          className="rounded-lg p-1 text-text-light hover:bg-gray-100 hover:text-text transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          title={isCollapsed ? "Expandir menú" : "Reducir menú"}
        >
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      <button
        onClick={onNewConversation}
          className={clsx(
          "mb-4 flex items-center justify-center rounded-lg border border-border bg-white font-medium text-text hover:border-primary hover:text-primary transition-all min-h-[44px]",
          isCollapsed ? "h-10 w-full" : "gap-2 px-3 py-2 text-xs"
        )}
        title="Nueva conversación"
      >
        <Plus size={18} />
        {!isCollapsed && "Nueva conversación"}
      </button>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto scrollbar-thin">
        {!isCollapsed && (
          <p className="mb-2 text-xs font-medium uppercase text-text-light tracking-wider">Conversaciones</p>
        )}
        
        {conversations.length === 0 ? (
          !isCollapsed && (
            <p className="text-xs text-text-light">
            No hay conversaciones. Crea una nueva para comenzar.
          </p>
          )
        ) : (
          conversations.map((conv, index) => (
            <div
              key={conv.id}
              className={clsx(
                "group relative flex cursor-pointer items-center rounded-xl transition-all duration-200 animate-fade-in",
                currentConversationId === conv.id
                  ? "bg-primary text-white border border-primary"
                  : "bg-white border border-transparent hover:bg-gray-50 hover:border-border",
                isCollapsed ? "justify-center p-2" : "p-3"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => onSelectConversation(conv.id)}
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
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
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
                        handleStartRename(conv);
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

              {!isCollapsed && editingId !== conv.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  className={clsx(
                    "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-all hover:scale-110 group-hover:opacity-100 rounded p-1",
                    currentConversationId === conv.id ? "hover:bg-white/20 text-white" : "hover:bg-red-100 text-red-500"
                  )}
                  title="Eliminar conversación"
                >
                  <Trash2 size={14} />
            </button>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
