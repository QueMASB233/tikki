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
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-sm min-h-[64px]">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Abrir menú"
          >
            <PanelLeftOpen size={20} />
          </button>
        )}
        <img
          src="https://storage.googleapis.com/msgsndr/IRGxH3YhbSBNF8NVepYv/media/6813b73ace8c9719e636ba19.png"
          alt="Estudia Seguro"
          className="h-6 sm:h-8 w-auto flex-shrink-0"
        />
        <div className="min-w-0 hidden sm:block">
          <h2 className="text-sm font-semibold text-brand-dark truncate">
            Asesor académico IA
          </h2>
          <p className="text-xs text-slate-500 truncate">
            Memoria activa para {user?.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <button
          onClick={onLogout}
          className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-brand-primary hover:text-brand-primary transition-colors min-h-[44px] whitespace-nowrap"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

