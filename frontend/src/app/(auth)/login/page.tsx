"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  login as loginRequest,
  setAuthToken
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [router, user]);

  // Si viene con session_id, redirigir al onboarding
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      router.push(`/onboarding?session_id=${sessionId}`);
      return;
    }
  }, [searchParams, router]);

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await loginRequest(email, password);
      
      if (response.token) {
        setAuthToken(response.token);
        localStorage.setItem("es_token", response.token);
      }
      
      if (response.user) {
        setUser(response.user);
        router.push("/dashboard");
      }
    } catch (err: any) {
      throw err;
    }
  };

  const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }

    setLoading(true);
    try {
      await handleLogin(email, password);
    } catch (err: any) {
      console.error("[LoginPage] Error caught:", err);
      
      let detail = "Ocurrió un error. Intenta nuevamente.";
      
      if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error") || err?.code === "ECONNREFUSED") {
        detail = "Error de conexión: No se pudo conectar al servidor.";
      } else if (err?.response?.data?.detail) {
        detail = err.response.data.detail;
      } else if (err?.message) {
        detail = err.message;
      }
      
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white md:bg-gradient-to-br md:from-white md:via-pink-50/40 md:to-white px-4 sm:px-6 lg:px-8 overflow-x-hidden relative">
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
      
      <div className="w-full max-w-[400px] lg:max-w-[450px] space-y-6 sm:space-y-8 relative z-10">
        <div className="flex flex-col items-center">
          <h2 className="text-center text-2xl sm:text-3xl font-semibold tracking-tight text-text">
            ¡Hola! Soy Tikki
          </h2>
        </div>
        </div>
        <div className="w-full max-w-[400px] lg:max-w-[450px] space-y-6 sm:space-y-8 relative z-10 pt-4">
        <div className="flex flex-col items-center">
          <h4 className="text-center text-sm sm:text-base font-light tracking-tight text-text">
            Inicia sesión o regístrate para conversar conmigo...
          </h4>
        </div>

        <form className="mt-8 space-y-4 bg-white rounded-lg p-6 sm:p-8 border border-border shadow-minimal" onSubmit={handleLoginSubmit}>
          <div className="space-y-4">
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="peer block w-full rounded-lg border border-border px-4 py-3 text-[15px] text-text placeholder-transparent focus:border-primary focus:outline-none bg-white min-h-[44px] transition-all"
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
                required
                className="peer block w-full rounded-lg border border-border px-4 py-3 text-[15px] text-text placeholder-transparent focus:border-primary focus:outline-none bg-white min-h-[44px] transition-all"
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

          {error && (
            <div className="text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg py-2 px-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:opacity-90 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] transition-all"
          >
            {loading ? "Cargando..." : "Iniciar sesión"}
          </button>
        </form>

        <div className="text-center text-sm bg-white rounded-lg p-4 border border-border">
          <span className="text-text">
            ¿No tienes una cuenta?{" "}
          </span>
          <button
            onClick={() => {
              router.push("/onboarding");
            }}
            disabled={loading}
            className="font-medium text-primary hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Regístrate
          </button>
        </div>
        
        <div className="mt-auto flex flex-col items-center">
          <p className="text-xs text-text-light">
            Hecho para Amalia, por Mathias ❤️
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">Cargando...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
