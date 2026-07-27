import type { Config } from "tailwindcss";

/** Espelho de tema.ts — CORES, TIPOGRAFIA e FORMAS. Tema escuro único. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./componentes/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fundo: "#14120B",
        "fundo-profundo": "#0B0B0B",
        superficie: {
          DEFAULT: "#1E1B12",
          ativa: "#221F14",
          apagada: "#262215",
        },
        borda: {
          DEFAULT: "#2E2A1C",
          media: "#332E1E",
          forte: "#4A422A",
        },
        texto: {
          DEFAULT: "#F0EADA",
          medio: "#C9C2A8",
          suave: "#97907C",
          apagado: "#6E684F",
        },
        acao: {
          DEFAULT: "#F5CE0A",
          hover: "#C9A907",
          sobre: "#0B0B0B",
        },
        clube: "#B9BF92",
        alerta: "#C9622F",
      },
      fontFamily: {
        titulo: ["var(--fonte-titulo)", "system-ui", "sans-serif"],
        corpo: ["var(--fonte-corpo)", "system-ui", "sans-serif"],
      },
      // Nada menor que 13px.
      fontSize: {
        xs: ["13px", "18px"],
        sm: ["14px", "20px"],
        base: ["15px", "22px"],
        lg: ["17px", "24px"],
        xl: ["20px", "26px"],
        "2xl": ["24px", "30px"],
        "3xl": ["30px", "36px"],
        "4xl": ["38px", "42px"],
        "5xl": ["48px", "50px"],
        "6xl": ["60px", "60px"],
      },
      borderRadius: {
        bloco: "12px",
        card: "14px",
        grande: "18px",
        pill: "999px",
      },
      spacing: {
        toque: "44px",
      },
    },
  },
  plugins: [],
};

export default config;
