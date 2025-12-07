import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";
import AppProviders from "./providers";
import PWAPrompt from "@/components/pwa/pwa-prompt";
import ServiceWorkerRegister from "@/components/pwa/service-worker-register";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0a3aa3",
};

export const metadata: Metadata = {
  title: "Ladybug | Tu compañera diaria",
  description:
    "Tu compañera Ladybug te acompaña en tu día a día con inteligencia artificial y memoria personalizada.",
  metadataBase: new URL("https://estudia-seguro.vercel.app"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tikki",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a3aa3" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Tikki" />
      </head>
      <body className={inter.className}>
        <AppProviders>
          {children}
          <PWAPrompt />
          <ServiceWorkerRegister />
        </AppProviders>
      </body>
    </html>
  );
}

