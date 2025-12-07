"use client";

import { FormEvent, useState } from "react";


// Personalidades originales para el backend
const PERSONALITY_TYPES = [
  "Valiente y protectora",
  "Creativa y artística",
  "Analítica y estratégica",
  "Energética y entusiasta",
  "Tranquila y reflexiva",
  "Aventurera y curiosa"
];

// Mapeo de personalidades a personajes de Ladybug para mostrar en el frontend
const PERSONALITY_TO_CHARACTER: Record<string, { name: string }> = {
  "Valiente y protectora": {
    name: "Ladybug"
  },
  "Creativa y artística": {
    name: "Pigella"
  },
  "Analítica y estratégica": {
    name: "Rena Rouge"
  },
  "Energética y entusiasta": {
    name: "Carapace"
  },
  "Tranquila y reflexiva": {
    name: "Viperion"
  },
  "Aventurera y curiosa": {
    name: "Chat Noir"
  }
};

const FAVORITE_ACTIVITIES = [
  "Diseño y moda",
  "Deportes y actividad física",
  "Arte y creatividad",
  "Tecnología e innovación",
  "Música y entretenimiento",
  "Naturaleza y aventura",
  "Lectura y aprendizaje",
  "Socializar y conectar"
];

interface OnboardingFlowProps {
  onComplete: (data: {
    fullName: string;
    personalityType: string;
    favoriteActivity: string;
    dailyGoals: string;
    email: string;
    password: string;
  }) => Promise<void>;
  initialEmail?: string; // Email del checkout de Stripe
}

export function OnboardingFlow({ onComplete, initialEmail = "" }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [fullName, setFullName] = useState("");
  const [personalityType, setPersonalityType] = useState("");
  const [favoriteActivity, setFavoriteActivity] = useState("");
  const [dailyGoals, setDailyGoals] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleNext = () => {
    if (step < 5 && !isTransitioning) {
      setIsTransitioning(true);
      setSlideDirection("right");
      setTimeout(() => {
        setStep(step + 1);
        setError(null);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 300);
    }
  };

  const handlePrevious = () => {
    if (step > 1 && !isTransitioning) {
      setIsTransitioning(true);
      setSlideDirection("left");
      setTimeout(() => {
        setStep(step - 1);
        setError(null);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 300);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (step === 1 && !fullName.trim()) {
      setError("Por favor ingresa tu nombre.");
      return;
    }
    if (step === 2 && !personalityType) {
      setError("Por favor selecciona una personalidad.");
      return;
    }
    if (step === 3 && !favoriteActivity) {
      setError("Por favor selecciona tu actividad favorita.");
      return;
    }
    if (step === 4 && !dailyGoals.trim()) {
      setError("Por favor comparte tus objetivos diarios.");
      return;
    }
    if (step === 5 && (!email || !password)) {
      setError("Por favor completa tu correo electrónico y contraseña.");
      return;
    }
    if (step === 5 && password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (step === 5) {
      // Último paso: completar onboarding y crear cuenta
      setLoading(true);
      try {
        await onComplete({
          fullName,
          personalityType,
          favoriteActivity,
          dailyGoals,
          email,
          password
        });
      } catch (err: any) {
        setError(err?.message || "Error al crear la cuenta. Intenta nuevamente.");
        setLoading(false);
      }
      return;
    }

    handleNext();
  };

  const slideClass = isTransitioning
    ? slideDirection === "right"
      ? "slide-exit-left"
      : "slide-exit-right"
    : slideDirection === "right"
    ? "slide-enter-right"
    : "slide-enter-left";

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className={`space-y-6 ${slideClass}`}>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-text px-2">
              ¿Cómo te llamas?
            </h2>
            <div className="relative">
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
                className="peer block w-full rounded-lg border border-border px-4 py-3 text-[15px] text-text placeholder-transparent focus:border-primary focus:outline-none min-h-[44px] bg-white transition-all"
                placeholder="Tu nombre"
              />
              <label
                htmlFor="fullName"
                className="absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-xs text-text-light transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-0 peer-focus:text-xs peer-focus:text-primary"
              >
                Tu nombre
              </label>
            </div>
          </div>
        );

      case 2:
        return (
          <div className={`space-y-6 ${slideClass}`}>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-text px-2">
              ¡Hola, <span className="text-primary fade-in text-xl sm:text-2xl font-semibold">{fullName}</span>!<br/>¿Con qué personalidad te identificas?
            </h2>
            <div className="relative">
              <select
                id="personalityType"
                value={personalityType}
                onChange={(e) => setPersonalityType(e.target.value)}
                autoFocus
                className="peer block w-full rounded-lg border border-border px-4 py-3 text-[15px] text-text focus:border-primary focus:outline-none min-h-[44px] bg-white transition-all"
              >
                <option value="">Selecciona un personaje</option>
                {PERSONALITY_TYPES.map((type) => {
                  const character = PERSONALITY_TO_CHARACTER[type];
                  return (
                    <option key={type} value={type}>
                      {character.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className={`space-y-6 ${slideClass}`}>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-text px-2">
              ¡Genial, <span className="text-primary fade-in text-xl sm:text-2xl font-semibold">{fullName}</span>!<br/>¿Cuál es tu actividad favorita?
            </h2>
            <div className="relative">
              <select
                id="favoriteActivity"
                value={favoriteActivity}
                onChange={(e) => setFavoriteActivity(e.target.value)}
                autoFocus
                className="peer block w-full rounded-lg border border-border px-4 py-3 text-[15px] text-text focus:border-primary focus:outline-none min-h-[44px] bg-white transition-all"
              >
                <option value="">Selecciona tu actividad favorita</option>
                {FAVORITE_ACTIVITIES.map((activity) => (
                  <option key={activity} value={activity}>
                    {activity}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 4:
        return (
          <div className={`space-y-6 ${slideClass}`}>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-text px-2">
              <span className="text-primary fade-in text-xl sm:text-2xl font-semibold">{fullName}</span>, ¿cuáles son tus objetivos diarios?
            </h2>
            <div className="relative">
              <textarea
                id="dailyGoals"
                value={dailyGoals}
                onChange={(e) => setDailyGoals(e.target.value)}
                autoFocus
                rows={4}
                className="peer block w-full rounded-lg border border-border px-4 py-3 text-[15px] text-text placeholder-transparent focus:border-primary focus:outline-none min-h-[100px] bg-white transition-all resize-none"
                placeholder="Ej: Organizar mi día, mantener motivación..."
              />
              <label
                htmlFor="dailyGoals"
                className="absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-xs text-text-light transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-0 peer-focus:text-xs peer-focus:text-primary"
              >
                Tus objetivos diarios
              </label>
            </div>
          </div>
        );

      case 5:
        return (
          <div className={`space-y-6 ${slideClass}`}>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-text px-2">
              ¡Perfecto, <span className="text-primary fade-in text-xl sm:text-2xl font-semibold">{fullName}</span>!<br/>Crea tu cuenta para comenzar.
            </h2>
            <div className="space-y-4">
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                  className="peer block w-full rounded-lg border border-border px-4 py-3 text-[15px] text-text placeholder-transparent focus:border-primary focus:outline-none min-h-[44px] bg-white transition-all"
                  placeholder="Correo electrónico"
                />
                <label
                  htmlFor="email"
                  className="absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-xs text-text-light transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-0 peer-focus:text-xs peer-focus:text-primary"
                >
                  Correo electrónico
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                  className="peer block w-full rounded-lg border border-border px-4 py-3 text-[15px] text-text placeholder-transparent focus:border-primary focus:outline-none min-h-[44px] bg-white transition-all"
                  placeholder="Contraseña"
                />
                <label
                  htmlFor="password"
                  className="absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-xs text-text-light transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-0 peer-focus:text-xs peer-focus:text-primary"
                >
                  Contraseña
                </label>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white md:bg-gradient-to-br md:from-white md:via-pink-50/40 md:to-white px-4 sm:px-6 lg:px-8 py-8 relative">
      {/* Logo en esquina superior derecha */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <img
          src="https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/i/d14ea819-bcbe-49dc-99b9-e81086106809/dfrh2ua-b7109a51-d4a9-4ad3-a296-5080c8f2c81d.png"
          alt="Ladybug"
          className="h-12 w-12 sm:h-14 sm:w-14 object-contain"
        />
      </div>

      {/* Efectos decorativos de fondo solo en desktop */}
      <div className="hidden md:block absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-ladybug-pink/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-ladybug-red/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-[500px] lg:max-w-[550px] space-y-8 sm:space-y-10 relative z-10">

        <form className="mt-8 space-y-6 bg-white rounded-lg p-8 sm:p-10 border border-border shadow-minimal" onSubmit={handleSubmit}>
          <div className="flex flex-col relative overflow-hidden">
            <div className="w-full">
              {renderStep()}
            </div>
          </div>

          {error && (
            <div className="text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg py-2 px-3">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="flex-1 rounded-lg border border-border px-4 py-3 text-sm font-medium text-text hover:bg-gray-50 focus:outline-none min-h-[44px] transition-all"
              >
                Anterior
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`${step > 1 ? 'flex-1' : 'w-full'} rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:opacity-90 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] transition-all`}
            >
              {loading ? "Creando cuenta..." : step === 5 ? "Crear cuenta" : "Continuar"}
            </button>
          </div>

          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-2 w-2 rounded-full transition-all ${
                  s === step
                    ? "bg-primary"
                    : s < step
                    ? "bg-primary/50"
                    : "bg-border"
                }`}
              />
            ))}
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.8s ease-out 0.2s both;
        }
      `}</style>
    </div>
  );
}

