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
        // Clareados de propósito: o público vai do adolescente ao senhor de 70,
        // e os tons originais (#97907C e #6E684F) ficavam em 5:1 e 3:1 sobre o
        // fundo. Agora nenhum texto fica abaixo de 4.5:1, que é o mínimo para
        // quem lê sem óculos no celular, no sol.
        texto: {
          DEFAULT: "#F5F0E4",
          medio: "#D6CFB8",
          suave: "#B3AC94",
          apagado: "#8E876B",
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
      /**
       * Escala subida um degrau inteiro. O piso saiu de 13px para 15px: 13px
       * é confortável para quem desenha a tela, não para quem marca corte no
       * ônibus. A entrelinha também cresceu, que é o que mais ajuda quem lê
       * devagar.
       */
      fontSize: {
        xs: ["15px", "22px"],
        sm: ["16px", "24px"],
        base: ["17px", "26px"],
        lg: ["19px", "28px"],
        xl: ["22px", "30px"],
        "2xl": ["26px", "33px"],
        "3xl": ["32px", "38px"],
        "4xl": ["40px", "44px"],
        "5xl": ["50px", "52px"],
        "6xl": ["62px", "62px"],
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
