import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Colores minimalistas estilo Apple
        "primary": "#ff0000",
        "text": "#242020",
        "text-light": "#6b6b6b",
        "border": "#e5e5e5",
        // Mantener compatibilidad temporal
        "ladybug-red": "#ff0000",
        "ladybug-pink": "#ff0000",
        "ladybug-black": "#242020",
        "brand-primary": "#ff0000",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(135deg, #ff0000 0%, #ff3333 100%)",
        "ladybug-gradient": "linear-gradient(135deg, #ff0000 0%, #ff3333 100%)",
      },
      boxShadow: {
        "minimal": "0 2px 10px rgba(0, 0, 0, 0.08)",
        "minimal-lg": "0 4px 20px rgba(0, 0, 0, 0.12)",
        "ladybug": "0 2px 10px rgba(0, 0, 0, 0.08)",
        "ladybug-lg": "0 4px 20px rgba(0, 0, 0, 0.12)",
      },
      animation: {
        "ladybug-shine": "shine 3s infinite",
        "ladybug-pulse": "pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
      },
      keyframes: {
        shine: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" }
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(233, 30, 99, 0.4)" },
          "50%": { boxShadow: "0 0 40px rgba(233, 30, 99, 0.8)" }
        }
      }
    }
  },
  plugins: []
};

export default config;

