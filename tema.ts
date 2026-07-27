/** Cores da Johny Barbearia. Espelhar em tailwind.config.ts como theme.extend.colors. */
export const CORES = {
  fundo: "#14120B",
  fundoProfundo: "#0B0B0B",
  superficie: "#1E1B12",
  superficieAtiva: "#221F14",
  superficieApagada: "#262215",
  borda: "#2E2A1C",
  bordaMedia: "#332E1E",
  bordaForte: "#4A422A",
  texto: "#F0EADA",
  textoMedio: "#C9C2A8",
  textoSuave: "#97907C",
  textoApagado: "#6E684F",
  acao: "#F5CE0A",
  acaoHover: "#C9A907",
  sobreAcao: "#0B0B0B",
  clube: "#B9BF92",
  alerta: "#C9622F",
} as const;

export const TIPOGRAFIA = {
  titulos: "Outfit, system-ui, sans-serif",
  corpo: "'DM Sans', system-ui, sans-serif",
  pesos: { titulo: [600, 700], corpo: [400, 500] },
  minimo: "13px",
  regras: [
    "Números e dinheiro: tabular-nums + white-space: nowrap",
    "Títulos de seção: Outfit 700, letter-spacing -0.02em",
    "Amarelo só em ação, item selecionado e valor em destaque",
  ],
} as const;

export const FORMAS = {
  raioCard: "14px",
  raioCardGrande: "18px",
  raioBotao: "999px",
  gapSecao: "24px",
  paddingCard: "18px 22px",
  alvoToqueMin: "44px",
  breakpoints: { sm: 640, lg: 1024, xl: 1280 },
} as const;
