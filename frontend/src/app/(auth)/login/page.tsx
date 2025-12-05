"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  login as loginRequest,
  setAuthToken,
  createCheckoutSession
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="w-full max-w-[400px] lg:max-w-[450px] space-y-6 sm:space-y-8">
        <div className="flex flex-col items-center">
          <img
            src="https://storage.googleapis.com/msgsndr/IRGxH3YhbSBNF8NVepYv/media/67ec02b6379294639cf06e08.png"
            alt="Estudia Seguro"
            className="mb-6 h-12 w-auto"
          />
          <h2 className="text-center text-3xl font-bold tracking-tight text-[#2d333a]">
            Te damos la bienvenida
          </h2>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleLoginSubmit}>
          <div className="space-y-4">
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="peer block w-full rounded-md border border-[#c2c8d0] px-4 py-3 text-[15px] text-[#2d333a] placeholder-transparent focus:border-brand-primary focus:outline-none focus:ring-0 min-h-[44px]"
                placeholder="Correo electrónico"
              />
              <label
                htmlFor="email"
                className="absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-xs text-[#6f7780] transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-[#6f7780] peer-focus:top-0 peer-focus:text-xs peer-focus:text-brand-primary"
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
                className="peer block w-full rounded-md border border-[#c2c8d0] px-4 py-3 text-[15px] text-[#2d333a] placeholder-transparent focus:border-brand-primary focus:outline-none focus:ring-0"
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

          {error && (
            <div className="text-center text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-primary px-4 py-3 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
          >
            {loading ? "Cargando..." : "Iniciar sesión"}
          </button>
        </form>

        <div className="text-center text-sm">
          <span className="text-[#6f7780]">
            ¿No tienes una cuenta?
          </span>{" "}
          <button
            onClick={async () => {
              setRegisterLoading(true);
              setError(null);
              try {
                const returnUrl = `${window.location.origin}/onboarding`;
                const checkoutUrl = await createCheckoutSession(returnUrl);
                window.location.href = checkoutUrl;
              } catch (err: any) {
                const errorMessage = err?.response?.data?.detail || err?.message || "Error al iniciar el proceso de registro. Intenta nuevamente.";
                setError(errorMessage);
                setRegisterLoading(false);
              }
            }}
            disabled={registerLoading || loading}
            className="font-medium text-brand-primary hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {registerLoading ? "Cargando..." : "Regístrate"}
          </button>
        </div>
        
        {/* Optional Footer Links like ChatGPT */}
        <div className="mt-auto flex flex-col items-center gap-2">
          <div className="flex justify-center gap-4 text-xs text-[#6f7780]">
            <a href="/terminos" className="hover:underline">Términos de uso</a>
            <span>|</span>
            <a href="/privacidad" className="hover:underline">Política de privacidad</a>
          </div>
          <div className="mt-2">
            <a 
              href="/admin" 
              className="text-xs text-[#6f7780] hover:text-brand-primary hover:underline"
            >
              ¿Eres administrador? Accede al portal
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
