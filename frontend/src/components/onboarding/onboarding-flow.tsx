"use client";

import { FormEvent, useState, useEffect } from "react";
import { PaymentSuccessAnimation } from "./payment-success-animation";

const LATIN_AMERICAN_COUNTRIES = [
  { name: "Argentina", flag: "🇦🇷" },
  { name: "Bolivia", flag: "🇧🇴" },
  { name: "Brasil", flag: "🇧🇷" },
  { name: "Chile", flag: "🇨🇱" },
  { name: "Colombia", flag: "🇨🇴" },
  { name: "Costa Rica", flag: "🇨🇷" },
  { name: "Cuba", flag: "🇨🇺" },
  { name: "República Dominicana", flag: "🇩🇴" },
  { name: "Ecuador", flag: "🇪🇨" },
  { name: "El Salvador", flag: "🇸🇻" },
  { name: "Guatemala", flag: "🇬🇹" },
  { name: "Honduras", flag: "🇭🇳" },
  { name: "México", flag: "🇲🇽" },
  { name: "Nicaragua", flag: "🇳🇮" },
  { name: "Panamá", flag: "🇵🇦" },
  { name: "Paraguay", flag: "🇵🇾" },
  { name: "Perú", flag: "🇵🇪" },
  { name: "Puerto Rico", flag: "🇵🇷" },
  { name: "Uruguay", flag: "🇺🇾" },
  { name: "Venezuela", flag: "🇻🇪" }
].sort((a, b) => a.name.localeCompare(b.name));

const STUDY_TYPES = [
  "Grado (Licenciatura)",
  "Máster",
  "Doctorado",
  "Posgrado",
  "Curso de especialización",
  "Otro"
];

interface OnboardingFlowProps {
  onComplete: (data: {
    fullName: string;
    studyType: string;
    careerInterest: string;
    nationality: string;
    email: string;
    password: string;
  }) => Promise<void>;
  initialEmail?: string; // Email del checkout de Stripe
}

export function OnboardingFlow({ onComplete, initialEmail = "" }: OnboardingFlowProps) {
  const [showAnimation, setShowAnimation] = useState(true);
  const [step, setStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [fullName, setFullName] = useState("");
  const [studyType, setStudyType] = useState("");
  const [careerInterest, setCareerInterest] = useState("");
  const [nationality, setNationality] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Actualizar email cuando initialEmail cambie
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleAnimationComplete = () => {
    setShowAnimation(false);
  };

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
    if (step === 2 && !studyType) {
      setError("Por favor selecciona un tipo de estudio.");
      return;
    }
    if (step === 3 && !careerInterest.trim()) {
      setError("Por favor ingresa la carrera que te interesa.");
      return;
    }
    if (step === 4 && !nationality) {
      setError("Por favor selecciona tu nacionalidad.");
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
          studyType,
          careerInterest,
          nationality,
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
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-[#2d333a] px-2">
              ¿Cómo te llamas?
            </h2>
            <div className="relative">
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
                className="peer block w-full rounded-md border border-[#c2c8d0] px-4 py-3 text-[15px] text-[#2d333a] placeholder-transparent focus:border-brand-primary focus:outline-none focus:ring-0 min-h-[44px]"
                placeholder="Tu nombre"
              />
              <label
                htmlFor="fullName"
                className="absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-xs text-[#6f7780] transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-[#6f7780] peer-focus:top-0 peer-focus:text-xs peer-focus:text-brand-primary"
              >
                Tu nombre
              </label>
            </div>
          </div>
        );

      case 2:
        return (
          <div className={`space-y-6 ${slideClass}`}>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-[#2d333a] px-2">
              Un gusto conocerte, <span className="text-brand-primary fade-in text-xl sm:text-2xl font-semibold">{fullName}</span> ¿qué tipo de estudio buscas?
            </h2>
            <div className="relative">
              <select
                id="studyType"
                value={studyType}
                onChange={(e) => setStudyType(e.target.value)}
                autoFocus
                className="peer block w-full rounded-md border border-[#c2c8d0] px-4 py-3 text-[15px] text-[#2d333a] focus:border-brand-primary focus:outline-none focus:ring-0 bg-white min-h-[44px]"
              >
                <option value="">Selecciona una opción</option>
                {STUDY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className={`space-y-6 ${slideClass}`}>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-[#2d333a] px-2">
              Genial, <span className="text-brand-primary fade-in text-xl sm:text-2xl font-semibold">{fullName}</span>. ¿En qué carrera buscas obtener un <span className="text-brand-primary fade-in text-xl sm:text-2xl font-semibold">{studyType}</span>?
            </h2>
            <div className="relative">
              <input
                id="careerInterest"
                type="text"
                value={careerInterest}
                onChange={(e) => setCareerInterest(e.target.value)}
                autoFocus
                className="peer block w-full rounded-md border border-[#c2c8d0] px-4 py-3 text-[15px] text-[#2d333a] placeholder-transparent focus:border-brand-primary focus:outline-none focus:ring-0 min-h-[44px]"
                placeholder="Ej: Medicina, Ingeniería, Derecho..."
              />
              <label
                htmlFor="careerInterest"
                className="absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-xs text-[#6f7780] transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-[#6f7780] peer-focus:top-0 peer-focus:text-xs peer-focus:text-brand-primary"
              >
                Carrera
              </label>
            </div>
          </div>
        );

      case 4:
        return (
          <div className={`space-y-6 ${slideClass}`}>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-[#2d333a] px-2">
              Excelente. ¿Bajo qué nacionalidad buscas estudiar en España un <span className="text-brand-primary fade-in text-xl sm:text-2xl font-semibold">{studyType}</span> en <span className="text-brand-primary fade-in text-xl sm:text-2xl font-semibold">{careerInterest}</span>?
            </h2>
            <div className="relative">
              <select
                id="nationality"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                autoFocus
                className="peer block w-full rounded-md border border-[#c2c8d0] px-4 py-3 text-[15px] text-[#2d333a] focus:border-brand-primary focus:outline-none focus:ring-0 bg-white min-h-[44px]"
              >
                <option value="">Selecciona tu nacionalidad</option>
                {LATIN_AMERICAN_COUNTRIES.map((country) => (
                  <option key={country.name} value={country.name}>
                    {country.flag} {country.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 5:
        return (
          <div className={`space-y-6 ${slideClass}`}>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-[#2d333a] px-2">
              Muchas gracias, <span className="text-brand-primary fade-in text-xl sm:text-2xl font-semibold">{fullName}</span>. Ahora crea tu cuenta con correo electrónico y contraseña.
            </h2>
            <div className="space-y-4">
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className="peer block w-full rounded-md border border-[#c2c8d0] px-4 py-3 text-[15px] text-[#6f7780] bg-gray-50 cursor-not-allowed min-h-[44px]"
                  placeholder="Correo electrónico"
                />
                <label
                  htmlFor="email"
                  className="absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-xs text-[#6f7780]"
                >
                  Correo electrónico (del pago)
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
                  className="peer block w-full rounded-md border border-[#c2c8d0] px-4 py-3 text-[15px] text-[#2d333a] placeholder-transparent focus:border-brand-primary focus:outline-none focus:ring-0 min-h-[44px]"
                  placeholder="Contraseña"
                />
                <label
                  htmlFor="password"
                  className="absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-xs text-[#6f7780] transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-[#6f7780] peer-focus:top-0 peer-focus:text-xs peer-focus:text-brand-primary"
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

  // Mostrar animación primero
  if (showAnimation) {
    return <PaymentSuccessAnimation onComplete={handleAnimationComplete} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="w-full max-w-[400px] lg:max-w-[450px] space-y-6 sm:space-y-8 animate-slide-up">
        <div className="flex flex-col items-center">
          <img
            src="https://storage.googleapis.com/msgsndr/IRGxH3YhbSBNF8NVepYv/media/67ec02b6379294639cf06e08.png"
            alt="Estudia Seguro"
            className="mb-6 h-12 w-auto"
          />
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="min-h-[200px] relative overflow-hidden">
            <div className="w-full">
              {renderStep()}
            </div>
          </div>

          {error && (
            <div className="text-center text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="flex-1 rounded-md border border-[#c2c8d0] px-4 py-3 text-sm font-medium text-[#2d333a] hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 min-h-[44px]"
              >
                Anterior
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`${step > 1 ? 'flex-1' : 'w-full'} rounded-md bg-brand-primary px-4 py-3 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]`}
            >
              {loading ? "Creando cuenta..." : step === 5 ? "Crear cuenta" : "Continuar"}
            </button>
          </div>

          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-2 w-2 rounded-full transition-colors ${
                  s === step
                    ? "bg-brand-primary"
                    : s < step
                    ? "bg-brand-primary opacity-50"
                    : "bg-gray-300"
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

