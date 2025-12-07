"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { signup } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export default function OnboardingPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleOnboardingComplete = async (data: {
    fullName: string;
    personalityType: string;
    favoriteActivity: string;
    dailyGoals: string;
    email: string;
    password: string;
  }) => {
    setError(null);
    try {
      // La función signup ya crea el usuario en Supabase Auth y en el backend
      const response = await signup(
        data.email,
        data.password,
        data.fullName,
        data.personalityType,
        data.favoriteActivity,
        data.dailyGoals
      );

      // Actualizar contexto de autenticación
      if (response.user) {
        setUser(response.user);
      }

      // Redirigir al dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Failed to complete onboarding:", err);
      const errorMessage = err?.response?.data?.detail || err?.message || "Error al completar el registro. Intenta nuevamente.";
      setError(errorMessage);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 bg-gradient-to-br from-white via-pink-50/40 to-white">
        <div className="text-center max-w-md bg-white/80 backdrop-blur-sm rounded-2xl p-8 border-2 border-ladybug-red/30 shadow-ladybug">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-lg text-red-600 mb-6 font-bold">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-3 bg-ladybug-gradient text-white rounded-lg hover:shadow-ladybug-glow font-bold transform hover:scale-105 transition-all shadow-ladybug"
          >
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <OnboardingFlow 
      onComplete={handleOnboardingComplete} 
      initialEmail=""
    />
  );
}

