"use client";

import { FormEvent, useState, KeyboardEvent, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  const handleSendMsg = async () => {
    setError(null);
    if (!value.trim()) {
      setError("Escribe un mensaje para continuar.");
      return;
    }
    const content = value.trim();
    setValue("");
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
    }
    
    try {
      await onSend(content);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "No se pudo enviar el mensaje."
      );
      // Restore value if failed? Maybe not for now to keep it simple
      setValue(content);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleSendMsg();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMsg();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3 sm:p-4">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
        {error && (
          <div className="text-sm text-red-500 px-1" role="alert">
            {error}
          </div>
        )}
        
        <div className="relative flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition-colors focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary/20">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta para el asesor..."
            className="max-h-48 min-h-[44px] w-full resize-none bg-transparent px-2 sm:px-3 py-2 sm:py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
            disabled={disabled}
            rows={1}
          />
          <button
            type="submit"
            className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-white shadow-sm transition-all hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px] min-w-[44px]"
            disabled={disabled || !value.trim()}
            aria-label="Enviar mensaje"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>
        
        <div className="text-center text-xs text-slate-400 px-1 hidden sm:block">
          Presiona Enter para enviar, Shift + Enter para nueva línea
        </div>
      </div>
    </form>
  );
}
