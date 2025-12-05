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
        "brand-primary": "#0a3aa3",
        "brand-secondary": "#7BD389",
        "brand-dark": "#052530",
        "brand-light": "#F6F9FC"
      }
    }
  },
  plugins: []
};

export default config;

