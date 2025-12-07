"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0, // Siempre considerar datos como stale para forzar refetch cuando se invalida
            gcTime: 1000 * 60 * 5, // 5 minutes - mantener en cache por 5min
            retry: 1,
            refetchOnWindowFocus: false, // No refetch al cambiar de ventana
            refetchOnReconnect: true, // Refetch al reconectar
            refetchOnMount: true, // Refetch al montar para asegurar datos frescos
          },
          mutations: {
            retry: 0, // No reintentar mutaciones
            // Retry logic se maneja manualmente en los hooks
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

