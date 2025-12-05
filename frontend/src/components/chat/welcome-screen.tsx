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
      <div className="mb-6 sm:mb-8 space-y-4 sm:space-y-6 w-full max-w-2xl">
        <div className="flex justify-center">
           {/* Logo from user request */}
           <img 
               src="https://storage.googleapis.com/msgsndr/IRGxH3YhbSBNF8NVepYv/media/67ec02b6379294639cf06e08.png" 
               alt="Estudia Seguro" 
               className="h-24 sm:h-32 w-auto object-contain"
           />
        </div>
        <h1 className="font-serif text-2xl sm:text-4xl text-[#2d333a] px-2">
          Hola, {userName || "estudiante"}
        </h1>
      </div>

      <div className="w-full max-w-2xl px-2">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-end gap-2 rounded-2xl sm:rounded-3xl border border-slate-200 bg-white px-3 sm:px-4 py-3 sm:py-4 shadow-sm transition-all focus-within:border-brand-primary/30 focus-within:ring-2 sm:focus-within:ring-4 focus-within:ring-brand-primary/10 hover:border-slate-300 hover:shadow-md">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="¿En qué te puedo ayudar hoy?"
              className="max-h-[200px] min-h-[44px] w-full resize-none bg-transparent py-2 text-sm sm:text-base text-slate-700 placeholder:text-slate-400 focus:outline-none"
              rows={1}
              autoFocus
            />
            <button
              type="submit"
              disabled={!value.trim()}
              className="mb-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-primary text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 min-h-[44px] min-w-[44px]"
              aria-label="Enviar mensaje"
            >
              <SendHorizonal size={16} />
            </button>
          </div>
        </form>

        <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
          {[
            { icon: "📝", text: "Resumir apuntes" },
            { icon: "📅", text: "Crear plan de estudio" },
            { icon: "🔍", text: "Investigar tema" },
            { icon: "💡", text: "Generar ideas" }
          ].map((suggestion) => (
            <button
              key={suggestion.text}
              onClick={() => onSend(suggestion.text)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-600 transition-all hover:border-brand-primary/30 hover:bg-slate-50 hover:text-brand-primary hover:shadow-sm min-h-[44px]"
            >
              <span>{suggestion.icon}</span>
              <span>{suggestion.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

