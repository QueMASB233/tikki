import { useState, useRef, useEffect } from "react";
import { SendHorizonal } from "lucide-react";

interface WelcomeScreenProps {
  userName?: string;
  onSend: (message: string) => void;
}

export function WelcomeScreen({ userName, onSend }: WelcomeScreenProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSend(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div className="flex h-full flex-col items-center justify-center p-4 sm:p-6 text-center overflow-y-auto">
      <div className="mb-8 space-y-6 w-full max-w-2xl">
        <div className="flex justify-center">
          <img
            src="https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/i/d14ea819-bcbe-49dc-99b9-e81086106809/dfrh2ua-b7109a51-d4a9-4ad3-a296-5080c8f2c81d.png"
            alt="Ladybug"
            className="h-20 sm:h-24 w-20 sm:w-24 object-contain"
          />
        </div>
        <h1 className="font-semibold text-2xl sm:text-3xl text-text px-2">
          Hola, {userName || "usuario"}
        </h1>
        <p className="text-text-light text-sm sm:text-base">
          ¿Qué lograremos juntas hoy?
        </p>
      </div>

      <div className="w-full max-w-2xl px-2">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-end gap-2 rounded-lg border border-border bg-white px-4 py-3 shadow-minimal transition-all focus-within:border-primary">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje..."
              className="max-h-[200px] min-h-[44px] w-full resize-none bg-transparent py-2 text-sm sm:text-base text-text placeholder:text-text-light focus:outline-none"
              rows={1}
              autoFocus
            />
            <button
              type="submit"
              disabled={!value.trim()}
              className="mb-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 min-h-[44px] min-w-[44px]"
              aria-label="Enviar mensaje"
            >
              <SendHorizonal size={16} strokeWidth={2.5} />
            </button>
          </div>
        </form>

        <div className="mt-6 w-full">
          <div className="overflow-x-auto scrollbar-hide -mx-2 px-2">
            <div className="flex gap-2 justify-start sm:justify-center min-w-max sm:min-w-0">
              {[
                { emoji: "✨", text: "Organizar mi día" },
                { emoji: "💪", text: "Motivación y ánimo" },
                { emoji: "🎯", text: "Recordar mis objetivos" },
                { emoji: "💬", text: "Charla y compañía" }
              ].map((suggestion) => (
                <button
                  key={suggestion.text}
                  onClick={() => onSend(suggestion.text)}
                  className="flex-shrink-0 rounded-lg border border-border bg-white px-4 py-2 text-xs sm:text-sm text-text font-medium transition-all hover:border-primary hover:text-primary min-h-[44px] whitespace-nowrap"
                >
                  <span className="mr-2">{suggestion.emoji}</span>
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

