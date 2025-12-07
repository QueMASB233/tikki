"use client";

import React, { useEffect, useState } from "react";

interface MessageSendBurstProps {
  trigger: boolean;
  intensity?: number;
}

/**
 * Componente de animación de partículas al enviar mensaje
 */
export function MessageSendBurst({ trigger, intensity = 1.0 }: MessageSendBurstProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    if (!trigger) return;

    // Crear partículas en posición aleatoria
    const newParticles = Array.from({ length: Math.floor(8 * intensity) }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }));

    setParticles(newParticles);

    // Limpiar partículas después de la animación
    const timer = setTimeout(() => {
      setParticles([]);
    }, 600);

    return () => clearTimeout(timer);
  }, [trigger, intensity]);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 bg-primary rounded-full opacity-70"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animation: "particleBurst 0.6s ease-out forwards",
          }}
        />
      ))}
      <style jsx>{`
        @keyframes particleBurst {
          0% {
            transform: scale(0) translate(0, 0);
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: scale(${1.5 * intensity}) translate(
              ${Math.random() * 40 - 20}px,
              ${Math.random() * 40 - 20}px
            );
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

