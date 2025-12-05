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
  title: "Estudia Seguro | Asesoría Académica IA",
  description:
    "Accede a un asesor académico inteligente con memoria para resolver dudas sobre universidades, becas y trámites.",
  metadataBase: new URL("https://estudia-seguro.vercel.app"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Estudia Seguro",
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
        <meta name="apple-mobile-web-app-title" content="Estudia Seguro" />
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

