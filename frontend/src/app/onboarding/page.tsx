"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getSessionInfo, completeSignup, setAuthToken } from "@/lib/api-client";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth-context";

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionIdParam = searchParams.get("session_id");
    
    if (!sessionIdParam) {
      setError("No se encontró la sesión de pago. Por favor, inicia el proceso nuevamente.");
      setLoading(false);
      return;
    }

    setSessionId(sessionIdParam);

    // Validar sesión y obtener email
    const fetchSessionInfo = async () => {
      try {
        const sessionData = await getSessionInfo(sessionIdParam);
        if (sessionData?.allowed && sessionData?.email) {
          setSessionEmail(sessionData.email);
        } else {
          setError("No se pudo validar la sesión de pago o el pago no ha sido completado.");
        }
      } catch (err: any) {
        console.error("Failed to fetch session info:", err);
        const errorMessage = err?.response?.data?.detail || err?.message || "Error al validar la sesión de pago. Por favor, intenta nuevamente.";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    void fetchSessionInfo();
  }, [searchParams]);

  const handleOnboardingComplete = async (data: {
    fullName: string;
    studyType: string;
    careerInterest: string;
    nationality: string;
    email: string;
    password: string;
  }) => {
    try {
      if (!sessionId) {
        throw new Error("No se encontró la sesión de pago.");
      }

      // Validar que el email coincida con el de la sesión de Stripe
      if (data.email !== sessionEmail) {
        throw new Error("El email debe coincidir con el usado para el pago.");
      }

      // Completar el registro en el backend
      // El backend creará el usuario en Supabase Auth, tabla users, HighLevel y marcará el intent como consumido
      const userResponse = await completeSignup(
        sessionId,
        data.email,
        data.password,
        data.fullName,
        data.studyType,
        data.careerInterest,
        data.nationality
      );

      // Iniciar sesión con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        throw new Error(authError.message || "Error al iniciar sesión");
      }

      // Guardar token y actualizar usuario
      if (authData.session) {
        const token = authData.session.access_token;
        localStorage.setItem("es_token", token);
        setAuthToken(token);
      }

      // Actualizar contexto de autenticación
      setUser({
        id: userResponse.id,
        email: userResponse.email,
        status: userResponse.status,
        full_name: userResponse.full_name,
        study_type: userResponse.study_type,
        career_interest: userResponse.career_interest,
        nationality: userResponse.nationality,
      });

      // Redirigir al dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Failed to complete onboarding:", err);
      const errorMessage = err?.response?.data?.detail || err?.message || "Error al completar el registro. Intenta nuevamente.";
      throw new Error(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-lg text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <OnboardingFlow 
      onComplete={handleOnboardingComplete} 
      initialEmail={sessionEmail}
    />
  );
}

