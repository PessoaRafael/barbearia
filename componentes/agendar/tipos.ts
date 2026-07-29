import type { Dia } from "@/lib/agenda/dias";

export type Servico = {
  id: string;
  nome: string;
  categoria: string;
  duracaoMin: number;
  precoCentavos: number;
  cobertoPeloClube: boolean;
  abateCentavos: number;
  tag: string | null;
};

export type Barbeiro = {
  id: string;
  nome: string;
  nomeCompleto: string;
  especialidade: string;
};

/** null = "tanto faz, primeiro que liberar" */
export type Escolha = string | null;

export type Livre = { hora: string; barbeiros: string[] };

export type FormaPagamento = "clube" | "pix" | "cadeira";

export function duracaoLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  if (!resto) return h === 1 ? "1 hora" : `${h} horas`;
  return `${h}h${String(resto).padStart(2, "0")}`;
}

/** Quanto o cliente paga se usar um crédito do clube. */
export function comClube(servico: Servico) {
  return Math.max(0, servico.precoCentavos - servico.abateCentavos);
}

export type { Dia };
