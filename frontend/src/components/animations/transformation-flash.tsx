"use client";

import React, { useEffect, useState } from "react";

interface TransformationFlashProps {
  trigger: boolean;
}

/**
 * Componente de destello rojo rápido cuando se activa el modo transformación
 */
export function TransformationFlash({ trigger }: TransformationFlashProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return;

    setIsVisible(true);

    // Flash rápido
    const timer1 = setTimeout(() => {
      setIsVisible(false);
    }, 200);

    // Segundo flash más suave
    const timer2 = setTimeout(() => {
      setIsVisible(true);
    }, 300);

    const timer3 = setTimeout(() => {
      setIsVisible(false);
    }, 450);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [trigger]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        background: "rgba(255, 0, 0, 0.15)",
        animation: "transformationFlash 0.15s ease-out",
      }}
    >
      <style jsx>{`
        @keyframes transformationFlash {
          0% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

