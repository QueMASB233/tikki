"use client";

import { useEffect, useState } from "react";

interface PaymentSuccessAnimationProps {
  onComplete: () => void;
}

export function PaymentSuccessAnimation({ onComplete }: PaymentSuccessAnimationProps) {
  const [stage, setStage] = useState<"lottie" | "thanks" | "excited" | "questions" | "complete">("lottie");
  const [showLottie, setShowLottie] = useState(true);
  const [showText, setShowText] = useState(false);
  const [fadeOutText, setFadeOutText] = useState(false);
  const [currentText, setCurrentText] = useState("");

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // Etapa 1: Mostrar animación Lottie (2 segundos)
    timers.push(
      setTimeout(() => {
        setShowLottie(false);
        setStage("thanks");
      }, 2000)
    );

    // Etapa 2: "Gracias de corazón" (2 segundos)
    timers.push(
      setTimeout(() => {
        setCurrentText("Gracias de corazón");
        setShowText(true);
        setFadeOutText(false);
        setStage("thanks");
      }, 2500)
    );

    // Fade out antes de desaparecer
    timers.push(
      setTimeout(() => {
        setFadeOutText(true);
      }, 4000)
    );

    timers.push(
      setTimeout(() => {
        setShowText(false);
        setFadeOutText(false);
        setStage("excited");
      }, 4500)
    );

    // Etapa 3: "¡Tu nuevo asesor virtual está emocionado..." (2.5 segundos)
    timers.push(
      setTimeout(() => {
        setCurrentText("¡Tu nuevo asesor virtual está emocionado de acompañarte en este viaje!");
        setShowText(true);
        setFadeOutText(false);
        setStage("excited");
      }, 5000)
    );

    // Fade out antes de desaparecer
    timers.push(
      setTimeout(() => {
        setFadeOutText(true);
      }, 7000)
    );

    timers.push(
      setTimeout(() => {
        setShowText(false);
        setFadeOutText(false);
        setStage("questions");
      }, 7500)
    );

    // Etapa 4: "Empecemos con preguntas básicas..." (2.5 segundos)
    timers.push(
      setTimeout(() => {
        setCurrentText("Empecemos con preguntas básicas para conocerte más a detalle...");
        setShowText(true);
        setFadeOutText(false);
        setStage("questions");
      }, 8000)
    );

    // Fade out antes de desaparecer
    timers.push(
      setTimeout(() => {
        setFadeOutText(true);
      }, 10000)
    );

    timers.push(
      setTimeout(() => {
        setShowText(false);
        setFadeOutText(false);
        setStage("complete");
        onComplete();
      }, 10500)
    );

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      {/* Animación Check Verde */}
      {showLottie && (
        <div
          className="absolute animate-slide-in-left"
        >
          <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center">
            {/* Círculo de pulso */}
            <div className="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full border-8 border-green-500 animate-ping opacity-20"></div>
            <div className="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-green-400/30"></div>
            
            {/* Círculo de fondo */}
            <div className="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-green-400/20 to-green-600/20 flex items-center justify-center shadow-lg">
              {/* Check verde animado */}
              <svg
                className="w-20 h-20 sm:w-24 sm:h-24 text-green-500 animate-scale-in"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={4}
                  d="M5 13l4 4L19 7"
                  className="animate-check-draw"
                />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Textos con animaciones suaves */}
      {showText && (
        <div className={`absolute transition-all duration-500 ${
          fadeOutText ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
        }`}>
          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-center text-gray-800 px-4 max-w-3xl leading-relaxed animate-fade-in-up">
            {currentText}
          </p>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-in-left {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes check-draw {
          from {
            stroke-dashoffset: 30;
            opacity: 0;
          }
          to {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slide-in-left {
          animation: slide-in-left 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .animate-scale-in {
          animation: scale-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
        }

        .animate-check-draw {
          stroke-dasharray: 30;
          animation: check-draw 0.8s ease-out 0.4s both;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}
