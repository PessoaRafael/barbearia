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
 * Um horário só entra na grade se o serviço inteiro couber: todos os slots
 * existem na grade (o almoço e o fim do expediente ficam de fora por
 * construção) e nenhum deles está ocupado.
 */
export function cabeNaAgenda(
  barbeiro: BarbeiroId,
  diaId: string,
  inicio: string,
  duracaoMin: number,
) {
  const ocupados = OCUPADOS[barbeiro][diaId] ?? [];
  return slotsOcupados(inicio, duracaoMin).every(
    (slot) => TODOS_HORARIOS.includes(slot) && !ocupados.includes(slot),
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
): BarbeiroId[] {
  if (estaFechado(diaId)) return [];
  return BARBEIROS.filter((b) =>
    cabeNaAgenda(b.id, diaId, inicio, duracaoMin),
  ).map((b) => b.id);
}

export function horarioLivre(
  escolha: Escolha,
  diaId: string,
  inicio: string,
  duracaoMin: number,
) {
  if (estaFechado(diaId)) return false;
  if (escolha === "qualquer")
    return barbeirosLivresEm(diaId, inicio, duracaoMin).length > 0;
  return cabeNaAgenda(escolha, diaId, inicio, duracaoMin);
}

export function contarLivres(
  escolha: Escolha,
  diaId: string,
  duracaoMin: number,
) {
  return TODOS_HORARIOS.filter((h) =>
    horarioLivre(escolha, diaId, h, duracaoMin),
  ).length;
}

export function livresPorTurno(
  escolha: Escolha,
  diaId: string,
  duracaoMin: number,
) {
  const conta = (lista: string[]) =>
    lista.filter((h) => horarioLivre(escolha, diaId, h, duracaoMin)).length;
  return { manha: conta(HORARIOS_MANHA), tarde: conta(HORARIOS_TARDE) };
}

/** Primeiro dia aberto da régua — usado como referência antes do passo 3. */
export function primeiroDiaAberto() {
  return (DIAS.find((d) => !d.fechado) ?? DIAS[0]).id;
}

const MESES: Record<string, string> = {
  jan: "janeiro",
  fev: "fevereiro",
  mar: "março",
  abr: "abril",
  mai: "maio",
  jun: "junho",
  jul: "julho",
  ago: "agosto",
  set: "setembro",
  out: "outubro",
  nov: "novembro",
  dez: "dezembro",
};

/** "27 de julho a 2 de agosto" — dá o mês uma vez só, em vez de repetir na régua. */
export function periodoDaRegua() {
  const primeiro = DIAS[0];
  const ultimo = DIAS[DIAS.length - 1];
  const dia = (n: string) => Number(n);

  if (primeiro.mes === ultimo.mes) {
    return `${dia(primeiro.numero)} a ${dia(ultimo.numero)} de ${MESES[primeiro.mes] ?? primeiro.mes}`;
  }
  return `${dia(primeiro.numero)} de ${MESES[primeiro.mes] ?? primeiro.mes} a ${dia(ultimo.numero)} de ${MESES[ultimo.mes] ?? ultimo.mes}`;
}

/** "hoje", "amanhã" ou "sáb 01/ago". */
export function rotuloDia(diaId: string) {
  const indice = DIAS.findIndex((d) => d.id === diaId);
  if (indice === 0) return "hoje";
  if (indice === 1) return "amanhã";
  const dia = DIAS[indice] ?? DIAS[0];
  return `${dia.diaSemana} ${dia.numero}/${dia.mes}`;
}
