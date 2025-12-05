"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from "@stripe/react-stripe-js";

interface EmbeddedCheckoutProps {
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onError?: (error: Error) => void;
}

function CheckoutForm({ onSuccess, onError }: { onSuccess: (id: string) => void; onError?: (error: Error) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Error al procesar el formulario");
        setLoading(false);
        return;
      }

      // Confirmar el SetupIntent
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/login?payment_success=true`,
        },
        redirect: "if_required", // No redirigir si no es necesario
      });

      if (confirmError) {
        setError(confirmError.message || "Error al procesar el pago");
        setLoading(false);
        return;
      }

      if (setupIntent && setupIntent.status === "succeeded") {
        // Pago exitoso
        onSuccess(setupIntent.id);
      } else {
        setError("El pago no se completó correctamente");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Error processing payment:", err);
      setError(err.message || "Error inesperado");
      setLoading(false);
      onError?.(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="text-sm text-red-600 mt-2">{error}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-brand-primary text-white py-3 px-4 rounded-md font-medium hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] mt-4"
      >
        {loading ? "Procesando..." : "Completar pago"}
      </button>
    </form>
  );
}

export function EmbeddedCheckout({ clientSecret, onSuccess, onError }: EmbeddedCheckoutProps) {
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeStripe = async () => {
      try {
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!publishableKey) {
          throw new Error("Stripe publishable key not configured");
        }

        const stripeInstance = await loadStripe(publishableKey);
        if (!stripeInstance) {
          throw new Error("Failed to load Stripe");
        }

        setStripePromise(Promise.resolve(stripeInstance));
        setLoading(false);
      } catch (error) {
        console.error("Error initializing Stripe:", error);
        onError?.(error as Error);
        setLoading(false);
      }
    };

    initializeStripe();
  }, [onError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-[#6f7780]">Cargando formulario de pago...</div>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="text-center text-red-600 py-4">
        Error al cargar Stripe
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: "stripe" as const,
    },
  };

  return (
    <div className="w-full">
      <Elements stripe={stripePromise} options={options}>
        <CheckoutForm onSuccess={onSuccess} onError={onError} />
      </Elements>
    </div>
  );
}

