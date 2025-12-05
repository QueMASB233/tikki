"use client";

import { useRouter } from "next/navigation";

export default function CancelledPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center max-w-md space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Pago cancelado
        </h1>
        <p className="text-gray-600">
          El proceso de pago fue cancelado. Si deseas continuar, puedes iniciar el proceso nuevamente.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => router.push("/login")}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}



