"use client";

import { FormEvent, useState, KeyboardEvent, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { useSound } from "@/lib/sounds/sound-manager";
import { MessageSendBurst } from "@/components/animations/message-send-burst";
import { appConfig } from "@/lib/config";

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [burstTrigger, setBurstTrigger] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { playSend } = useSound();

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
    
    // Reproducir sonido y animación
    if (appConfig.enableSounds) {
      playSend();
    }
    if (appConfig.enableMagicAnimations) {
      setBurstTrigger(true);
      setTimeout(() => setBurstTrigger(false), 100);
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
    <form onSubmit={handleSubmit} className="border-t border-border bg-white p-4 relative">
      <MessageSendBurst trigger={burstTrigger} intensity={appConfig.particleIntensity} />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
        {error && (
          <div className="text-sm text-red-600 px-3 bg-red-50 border border-red-200 rounded-lg py-2" role="alert">
            {error}
          </div>
        )}
        
        <div className="relative flex items-end gap-2 rounded-lg border border-border bg-white p-2 shadow-minimal transition-all focus-within:border-primary">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            className="max-h-48 min-h-[44px] w-full resize-none bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-light focus:outline-none disabled:opacity-50"
            disabled={disabled}
            rows={1}
            style={{ fontSize: '16px' }}
          />
          <button
            type="submit"
            className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 min-h-[44px] min-w-[44px]"
            disabled={disabled || !value.trim()}
            aria-label="Enviar mensaje"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>
        
        <div className="text-center text-xs text-text-light px-1 hidden sm:block">
          Presiona Enter para enviar, Shift + Enter para nueva línea
        </div>
      </div>
    </form>
  );
}
