export type BarbeiroId = "johny" | "diego" | "kaio";

export type Barbeiro = {
  id: BarbeiroId;
  nome: string;
  nomeCompleto: string;
  especialidade: string;
  foto: string | null;
};

export const BARBEIROS: Barbeiro[] = [
  { id: "johny", nome: "Johny", nomeCompleto: "Johny", especialidade: "navalha e barba", foto: null },
  { id: "diego", nome: "Diego", nomeCompleto: "Diego Nascimento", especialidade: "degradê", foto: null },
  { id: "kaio", nome: "Kaio", nomeCompleto: "Kaio Ferreira", especialidade: "platinado e sobrancelha", foto: null },
];

export type Dia = {
  id: string;
  diaSemana: string;
  numero: string;
  mes: string;
  fechado?: boolean;
};

export const DIAS: Dia[] = [
  { id: "d0", diaSemana: "seg", numero: "27", mes: "jul" },
  { id: "d1", diaSemana: "ter", numero: "28", mes: "jul" },
  { id: "d2", diaSemana: "qua", numero: "29", mes: "jul" },
  { id: "d3", diaSemana: "qui", numero: "30", mes: "jul" },
  { id: "d4", diaSemana: "sex", numero: "31", mes: "jul" },
  { id: "d5", diaSemana: "sáb", numero: "01", mes: "ago" },
  { id: "d6", diaSemana: "dom", numero: "02", mes: "ago", fechado: true },
];

export const HORARIOS_MANHA = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"];
export const HORARIOS_TARDE = ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"];
export const TODOS_HORARIOS = [...HORARIOS_MANHA, ...HORARIOS_TARDE];
export const ALMOCO = { inicio: "13:00", fim: "14:00", label: "almoço 13h às 14h" };
export const EXPEDIENTE = { abre: 9, fecha: 19 };

/** Horários já ocupados por barbeiro e por dia. */
export const OCUPADOS: Record<BarbeiroId, Record<string, string[]>> = {
  johny: {
    d0: ["09:00", "09:30", "10:30", "14:00", "14:30", "16:30", "17:00", "18:00"],
    d1: ["09:00", "11:30", "15:00", "15:30", "18:00"],
    d2: ["09:30", "10:00", "14:30", "17:30"],
    d3: ["11:00", "14:00", "17:00"],
    d4: ["09:00", "09:30", "11:00", "14:00", "15:00", "16:00", "17:00", "18:30"],
    d5: ["09:00", "09:30", "10:00", "10:30", "11:00", "12:00", "14:00", "14:30", "15:00", "16:30", "17:00", "18:00"],
    d6: [],
  },
  diego: {
    d0: ["10:00", "11:00", "14:30", "15:00", "16:00", "17:30", "18:30"],
    d1: ["10:00", "10:30", "14:00", "16:30"],
    d2: ["10:30", "11:00", "16:00"],
    d3: ["09:30", "12:00", "15:30"],
    d4: ["09:30", "10:00", "11:30", "14:30", "15:30", "16:30", "18:00"],
    d5: ["09:00", "10:00", "10:30", "11:30", "12:00", "14:30", "15:30", "16:00", "17:00", "17:30", "18:30"],
    d6: [],
  },
  kaio: {
    d0: ["09:00", "12:00", "14:00", "15:30", "16:00", "16:30", "17:00", "18:00", "18:30"],
    d1: ["09:30", "11:00", "14:30", "17:00"],
    d2: ["09:00", "12:30", "15:00", "18:00"],
    d3: ["10:00", "16:00"],
    d4: ["09:00", "10:30", "11:00", "12:30", "14:00", "15:00", "17:30", "18:00"],
    d5: ["09:30", "10:00", "11:00", "11:30", "14:00", "15:00", "15:30", "16:00", "17:30", "18:00", "18:30"],
    d6: [],
  },
};

/**
 * Horários ocupados para a seleção atual.
 * "qualquer" = só está ocupado quando os três barbeiros estão ocupados.
 */
export function ocupadosPara(barbeiro: BarbeiroId | "qualquer" | null, diaId: string): string[] {
  const dia = DIAS.find((d) => d.id === diaId);
  if (dia?.fechado) return [...TODOS_HORARIOS];
  if (!barbeiro) return [];
  if (barbeiro !== "qualquer") return OCUPADOS[barbeiro][diaId] ?? [];
  return TODOS_HORARIOS.filter((h) =>
    BARBEIROS.every((b) => (OCUPADOS[b.id][diaId] ?? []).includes(h))
  );
}

export const livresPara = (barbeiro: BarbeiroId | "qualquer" | null, diaId: string) =>
  TODOS_HORARIOS.length - ocupadosPara(barbeiro, diaId).length;
