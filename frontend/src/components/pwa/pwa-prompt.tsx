"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function PWAPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar si está en iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Detectar si la app ya está instalada (standalone mode)
    const standalone = (window.navigator as any).standalone === true || 
                       window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Si ya está instalada, no mostrar el prompt
    if (standalone) {
      return;
    }

    // Verificar si el usuario acaba de registrarse
    const justRegistered = localStorage.getItem('just-registered') === 'true';
    
    // Verificar si ya se mostró después del registro
    const hasShownAfterRegistration = localStorage.getItem('pwa-prompt-shown-after-registration') === 'true';
    
    // Verificar si ya se mostró en esta sesión (para usuarios que no acaban de registrarse)
    const hasShown = sessionStorage.getItem('pwa-prompt-shown');
    
    // Si acaba de registrarse y ya se mostró después del registro, no mostrar de nuevo
    if (justRegistered && hasShownAfterRegistration) {
      localStorage.removeItem('just-registered');
      return;
    }
    
    // Si no acaba de registrarse y ya se mostró en esta sesión, no mostrar
    if (!justRegistered && hasShown) {
      return;
    }

    // Solo mostrar en pantallas pequeñas (< 768px)
    const isMobile = window.innerWidth < 768;
    if (!isMobile) {
      // Si acaba de registrarse pero no es móvil, limpiar el flag
      if (justRegistered) {
        localStorage.removeItem('just-registered');
      }
      return;
    }

    // Para Android: capturar el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Si acaba de registrarse, mostrar inmediatamente
      // Si no, mostrar después de un delay
      const delay = justRegistered ? 1000 : 3000;
      
      setTimeout(() => {
        setShowPrompt(true);
        if (justRegistered) {
          localStorage.setItem('pwa-prompt-shown-after-registration', 'true');
          localStorage.removeItem('just-registered');
        } else {
          sessionStorage.setItem('pwa-prompt-shown', 'true');
        }
      }, delay);
    };

    // Para iOS: mostrar el prompt
    if (iOS) {
      // Si acaba de registrarse, mostrar inmediatamente
      // Si no, mostrar después de un delay
      const delay = justRegistered ? 1000 : 3000;
      
      setTimeout(() => {
        setShowPrompt(true);
        if (justRegistered) {
          localStorage.setItem('pwa-prompt-shown-after-registration', 'true');
          localStorage.removeItem('just-registered');
        } else {
          sessionStorage.setItem('pwa-prompt-shown', 'true');
        }
      }, delay);
    } else {
      // Para Android
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }

    // Listener para cuando se instala
    window.addEventListener('appinstalled', () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.removeItem('just-registered');
      localStorage.setItem('pwa-prompt-shown-after-registration', 'true');
    });

    return () => {
      if (!iOS) {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      }
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Android: mostrar el prompt nativo
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt || isStandalone) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-none sm:hidden">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 pointer-events-auto animate-slide-up">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <div className="pr-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            Instala Tikki en tu cell...
          </h3>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            {isIOS ? (
              <>
                Toca el botón <span className="font-semibold">&quot;Compartir&quot;</span> y selecciona{" "}
                <span className="font-semibold">&quot;Agregar a pantalla de inicio&quot;</span> para una mejor experiencia.
              </>
            ) : (
              <>
                Instala la app para acceder rápidamente y disfrutar de una experiencia optimizada.
              </>
            )}
          </p>
          
          {!isIOS && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="w-full bg-brand-primary text-white font-medium py-3 px-4 rounded-xl hover:bg-brand-primary/90 transition-colors active:scale-[0.98] min-h-[44px] flex items-center justify-center"
            >
              Instalar ahora
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

