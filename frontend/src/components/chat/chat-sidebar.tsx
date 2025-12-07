"use client";

import { useState, useEffect, useRef } from "react";
import { Conversation } from "@/lib/api-client";
import { Trash2, PanelLeftClose, PanelLeftOpen, MessageSquare, Plus } from "lucide-react";
import clsx from "clsx";
import { AnimatedTitle } from "./animated-title";
import { SwipeableConversation } from "./swipeable-conversation";

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
        title="Volver a la pantalla de inicio"
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
            <SwipeableConversation
              key={conv.id}
              conv={conv}
              currentConversationId={currentConversationId}
              isCollapsed={isCollapsed}
              editingId={editingId}
              editTitle={editTitle}
              inputRef={inputRef}
              onSelect={onSelectConversation}
              onStartRename={handleStartRename}
              onFinishRename={handleFinishRename}
              onKeyDown={handleKeyDown}
              onDelete={onDeleteConversation}
              index={index}
              onEditTitleChange={setEditTitle}
            />
          ))
        )}
      </div>
    </aside>
  );
}
