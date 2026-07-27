import {
  BARBEIROS,
  DIAS,
  HORARIOS_MANHA,
  HORARIOS_TARDE,
  OCUPADOS,
  TODOS_HORARIOS,
  type BarbeiroId,
} from "@/agenda";
import { minutos, hora } from "./formato";

export type Escolha = BarbeiroId | "qualquer";

/** Slots de 30 min que um serviço consome a partir de um horário. */
export function slotsOcupados(inicio: string, duracaoMin: number) {
  const passos = Math.max(1, Math.ceil(duracaoMin / 30));
  const base = minutos(inicio);
  return Array.from({ length: passos }, (_, i) => hora(base + i * 30));
}

/**
 * Slots ocupados que não estão na agenda mockada: bloqueios feitos no painel
 * e marcações criadas em tempo de execução. Chave `barbeiro|hora`.
 */
export type Extras = Set<string> | undefined;

/**
 * Um horário só entra na grade se o serviço inteiro couber: todos os slots
 * existem na grade (o almoço e o fim do expediente ficam de fora por
 * construção) e nenhum deles está ocupado ou bloqueado.
 */
export function cabeNaAgenda(
  barbeiro: BarbeiroId,
  diaId: string,
  inicio: string,
  duracaoMin: number,
  extras?: Extras,
) {
  const ocupados = OCUPADOS[barbeiro][diaId] ?? [];
  return slotsOcupados(inicio, duracaoMin).every(
    (slot) =>
      TODOS_HORARIOS.includes(slot) &&
      !ocupados.includes(slot) &&
      !extras?.has(`${barbeiro}|${slot}`),
  );
}

export function estaFechado(diaId: string) {
  return Boolean(DIAS.find((d) => d.id === diaId)?.fechado);
}

/** Quem consegue atender neste horário. "qualquer" pega o primeiro que liberar. */
export function barbeirosLivresEm(
  diaId: string,
  inicio: string,
  duracaoMin: number,
  extras?: Extras,
): BarbeiroId[] {
  if (estaFechado(diaId)) return [];
  return BARBEIROS.filter((b) =>
    cabeNaAgenda(b.id, diaId, inicio, duracaoMin, extras),
  ).map((b) => b.id);
}

export function horarioLivre(
  escolha: Escolha,
  diaId: string,
  inicio: string,
  duracaoMin: number,
  extras?: Extras,
) {
  if (estaFechado(diaId)) return false;
  if (escolha === "qualquer")
    return barbeirosLivresEm(diaId, inicio, duracaoMin, extras).length > 0;
  return cabeNaAgenda(escolha, diaId, inicio, duracaoMin, extras);
}

export function contarLivres(
  escolha: Escolha,
  diaId: string,
  duracaoMin: number,
  extras?: Extras,
) {
  return TODOS_HORARIOS.filter((h) =>
    horarioLivre(escolha, diaId, h, duracaoMin, extras),
  ).length;
}

export function livresPorTurno(
  escolha: Escolha,
  diaId: string,
  duracaoMin: number,
  extras?: Extras,
) {
  const conta = (lista: string[]) =>
    lista.filter((h) => horarioLivre(escolha, diaId, h, duracaoMin, extras))
      .length;
  return { manha: conta(HORARIOS_MANHA), tarde: conta(HORARIOS_TARDE) };
}

/** Primeiro dia aberto da régua — usado como referência antes do passo 3. */
export function primeiroDiaAberto() {
  return (DIAS.find((d) => !d.fechado) ?? DIAS[0]).id;
}

// Rótulos de dia e de período vivem em lib/semana.ts, que sabe qual semana
// está aberta.
