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
            staleTime: 1000 * 30, // 30 seconds - datos frescos por 30s
            gcTime: 1000 * 60 * 5, // 5 minutes - mantener en cache por 5min
            retry: 1,
            refetchOnWindowFocus: false, // No refetch al cambiar de ventana
            refetchOnReconnect: true, // Refetch al reconectar
            refetchOnMount: false, // No refetch al montar si hay datos en cache
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

