export type Categoria = "Cortes" | "Barba" | "Acabamento" | "Química";

export type Servico = {
  id: string;
  nome: string;
  duracaoMin: number;
  duracaoLabel: string;
  preco: number;
  /** Quanto o clube abate deste serviço (0 = não cobre). */
  clubeAbate: number;
  categoria: Categoria;
  tag?: string;
};

export const CATEGORIAS: Categoria[] = ["Cortes", "Barba", "Acabamento", "Química"];

export const SERVICOS: Servico[] = [
  { id: "corte-social", nome: "Corte social", duracaoMin: 30, duracaoLabel: "30 min", preco: 35, clubeAbate: 35, categoria: "Cortes" },
  { id: "corte-degrade", nome: "Corte degradê", duracaoMin: 40, duracaoLabel: "40 min", preco: 40, clubeAbate: 40, categoria: "Cortes", tag: "mais pedido" },
  { id: "corte-barba", nome: "Corte + barba", duracaoMin: 60, duracaoLabel: "1 hora", preco: 60, clubeAbate: 40, categoria: "Cortes", tag: "clube cobre o corte" },
  { id: "barba-navalha", nome: "Barba na navalha", duracaoMin: 30, duracaoLabel: "30 min", preco: 30, clubeAbate: 0, categoria: "Barba" },
  { id: "pezinho", nome: "Pezinho", duracaoMin: 15, duracaoLabel: "15 min", preco: 15, clubeAbate: 0, categoria: "Acabamento" },
  { id: "sobrancelha", nome: "Sobrancelha", duracaoMin: 10, duracaoLabel: "10 min", preco: 12, clubeAbate: 0, categoria: "Acabamento" },
  { id: "platinado", nome: "Platinado", duracaoMin: 120, duracaoLabel: "2 horas", preco: 150, clubeAbate: 0, categoria: "Química" },
];

export const servicoPorId = (id: string | null) =>
  SERVICOS.find((s) => s.id === id) ?? null;

/** Quanto o clube cobre e quanto sobra para o cliente pagar. */
export function calcularValor(servico: Servico | null, usarClube: boolean) {
  if (!servico) return { abatido: 0, aPagar: 0 };
  const abatido = usarClube ? Math.min(servico.clubeAbate, servico.preco) : 0;
  return { abatido, aPagar: servico.preco - abatido };
}

export const brl = (n: number) =>
  "R$ " + n.toFixed(2).replace(".", ",");
