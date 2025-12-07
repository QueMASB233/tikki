"use client";

import React from "react";
import clsx from "clsx";

interface BotAvatarGlowProps {
  isActive: boolean;
  children: React.ReactNode;
}

/**
 * Componente que añade un glow alrededor del avatar del bot cuando está "pensando"
 */
export function BotAvatarGlow({ isActive, children }: BotAvatarGlowProps) {
  return (
    <div className="relative inline-block">
      {children}
      {isActive && (
        <div
          className={clsx(
            "absolute inset-0 rounded-full",
            "bg-primary/20 blur-xl",
            "animate-pulse"
          )}
          style={{
            animation: "glowPulse 2s ease-in-out infinite",
          }}
        />
      )}
      <style jsx>{`
        @keyframes glowPulse {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}

