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
            src="https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/i/d14ea819-bcbe-49dc-99b9-e81086106809/dfrh2ua-b7109a51-d4a9-4ad3-a296-5080c8f2c81d.png"
            alt="Ladybug"
            className="h-12 w-12 mb-6 object-contain"
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



