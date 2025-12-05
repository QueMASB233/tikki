"use client";

import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/admin-context";
import { useEffect } from "react";

export default function AdminLandingPage() {
  const router = useRouter();
  const { admin, loading } = useAdmin();

  useEffect(() => {
    if (!loading && admin) {
      router.push("/admin/dashboard");
    }
  }, [admin, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex flex-col items-center">
          <img
            src="https://storage.googleapis.com/msgsndr/IRGxH3YhbSBNF8NVepYv/media/67ec02b6379294639cf06e08.png"
            alt="Estudia Seguro"
            className="mb-6 h-12 w-auto"
          />
          <h1 className="text-3xl font-bold tracking-tight text-[#2d333a]">
            Portal de Administración
          </h1>
          <p className="mt-2 text-sm text-[#6f7780]">
            Panel de administración académica
          </p>
        </div>

        <div className="mt-8">
          <button
            onClick={() => router.push("/admin/login")}
            className="w-full rounded-md bg-brand-primary px-4 py-3 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
          >
            Inicia sesión en tu cuenta de administrador
          </button>
        </div>
      </div>
    </div>
  );
}



