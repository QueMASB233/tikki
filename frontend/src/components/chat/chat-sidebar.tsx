"use client";

import { useState, useEffect, useRef } from "react";
import { Conversation } from "@/lib/api-client";
import { Trash2, PanelLeftClose, PanelLeftOpen, MessageSquare, Plus } from "lucide-react";
import clsx from "clsx";

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, newTitle: string) => void;
  onCloseMobile?: () => void;
}

export function ChatSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onCloseMobile,
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
          "h-full flex flex-col border-r border-slate-200 bg-[#f7f9fb] transition-all duration-300 w-full",
          isCollapsed ? "w-20 px-2 py-6" : "w-72 px-4 py-6"
        )}
      >
      <div className={clsx("mb-6 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
        <img
          src="https://storage.googleapis.com/msgsndr/IRGxH3YhbSBNF8NVepYv/media/6813b73ace8c9719e636ba19.png"
          alt="Estudia Seguro"
              className="h-8 w-auto flex-shrink-0"
        />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-dark">Estudia Seguro</p>
              <p className="truncate text-xs text-slate-500">Suscripción activa</p>
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
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
          title={isCollapsed ? "Expandir menú" : "Reducir menú"}
        >
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      <button
        onClick={onNewConversation}
        className={clsx(
          "mb-4 flex items-center justify-center rounded-xl border border-dashed border-brand-primary/40 bg-brand-primary/10 font-semibold text-brand-primary hover:border-brand-primary hover:bg-brand-primary/20 min-h-[44px]",
          isCollapsed ? "h-10 w-full" : "gap-2 px-3 py-2 text-xs"
        )}
        title="Nueva conversación"
      >
        <Plus size={18} />
        {!isCollapsed && "Nueva conversación"}
      </button>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto scrollbar-none">
        {!isCollapsed && (
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Conversaciones</p>
        )}
        
        {conversations.length === 0 ? (
          !isCollapsed && (
            <p className="text-xs italic text-slate-500">
            No hay conversaciones. Crea una nueva para comenzar.
          </p>
          )
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={clsx(
                "group relative flex cursor-pointer items-center rounded-xl transition-colors",
                currentConversationId === conv.id
                  ? "bg-brand-primary/20 border border-brand-primary/40"
                  : "bg-white border border-transparent hover:bg-slate-50",
                isCollapsed ? "justify-center p-2" : "p-3"
              )}
              onClick={() => onSelectConversation(conv.id)}
            >
              {isCollapsed ? (
                <MessageSquare size={18} className="text-slate-500" />
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
                      className="w-full rounded border border-brand-primary px-1 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    <p
                      className="line-clamp-2 font-medium text-slate-700"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(conv);
                      }}
                      title={conv.title || "Sin título"}
                    >
                {conv.title || "Sin título"}
              </p>
                  )}
                  <p className="mt-1 text-[10px] text-slate-400">
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
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
