"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/admin-context";

const ADMIN_DOMAIN = "@estudiaseguro.com";

export default function AdminLoginPage() {
  const router = useRouter();
  
  // Manejar errores del contexto de forma segura
  let adminContext;
  try {
    adminContext = useAdmin();
  } catch (error) {
    console.error("Error con AdminContext:", error);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center text-red-600">
          Error: El contexto de administrador no está disponible. 
          Asegúrate de que AdminProvider esté configurado correctamente.
        </div>
      </div>
    );
  }

  const { admin, login, loading: authLoading } = adminContext;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (admin) {
      router.push("/admin/dashboard");
    }
  }, [admin, router]);

  const validateEmail = (email: string): boolean => {
    return email.endsWith(ADMIN_DOMAIN);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }

    if (!validateEmail(email)) {
      setError(`Solo se permiten correos con dominio ${ADMIN_DOMAIN}`);
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      router.push("/admin/dashboard");
    } catch (err: any) {
      console.error("[AdminLogin] Error:", err);
      let detail = "Ocurrió un error. Intenta nuevamente.";
      if (err?.response?.data?.detail) {
        detail = err.response.data.detail;
      } else if (err?.message) {
        detail = err.message;
      }
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="w-full max-w-[400px] lg:max-w-[450px] space-y-6 sm:space-y-8">
        <div className="flex flex-col items-center">
          <img
            src="https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/i/d14ea819-bcbe-49dc-99b9-e81086106809/dfrh2ua-b7109a51-d4a9-4ad3-a296-5080c8f2c81d.png"
            alt="Ladybug"
            className="h-12 w-12 mb-6 object-contain"
          />
          <h2 className="text-center text-3xl font-bold tracking-tight text-[#2d333a]">
            Iniciar sesión
          </h2>
          <p className="mt-2 text-sm text-[#6f7780]">
            Inicia sesión con tu correo institucional
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="peer block w-full rounded-md border border-[#c2c8d0] px-4 py-3 text-[15px] text-[#2d333a] placeholder-transparent focus:border-brand-primary focus:outline-none focus:ring-0 min-h-[44px]"
              placeholder={`Correo ${ADMIN_DOMAIN}`}
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

          {error && (
            <div className="text-center text-sm text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#0a3aa3] px-4 py-3 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#0a3aa3] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
          >
            {loading ? "Cargando..." : "Iniciar sesión"}
          </button>
        </form>


        <div className="text-center">
          <button
            onClick={() => router.push("/admin")}
            className="text-sm text-[#6f7780] hover:text-[#2d333a]"
          >
            ← Volver
          </button>
        </div>
      </div>
    </div>
  );
}

