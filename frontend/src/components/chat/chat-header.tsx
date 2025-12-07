"use client";

import { useAuth } from "@/lib/auth-context";
import { PanelLeftOpen } from "lucide-react";

interface ChatHeaderProps {
  onLogout: () => void;
  onToggleSidebar?: () => void;
}

export function ChatHeader({ onLogout, onToggleSidebar }: ChatHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-4 sm:px-6 min-h-[64px]">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden rounded-lg p-2 text-text-light hover:bg-gray-100 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Abrir menú"
          >
            <PanelLeftOpen size={20} />
          </button>
        )}
        <img
          src="https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/i/d14ea819-bcbe-49dc-99b9-e81086106809/dfrh2ua-b7109a51-d4a9-4ad3-a296-5080c8f2c81d.png"
          alt="Ladybug"
          className="h-6 sm:h-8 w-6 sm:w-8 object-contain"
        />
        <div className="min-w-0 hidden sm:block">
          <h2 className="text-sm font-semibold text-text truncate">
            {user?.full_name || "Usuario"}
          </h2>
          <p className="text-xs text-text-light truncate">
            {user?.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onLogout}
          className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-text hover:border-primary hover:text-primary transition-all min-h-[44px] whitespace-nowrap"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

