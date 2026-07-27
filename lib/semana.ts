/**
 * A agenda abre uma semana por vez e renova na segunda. É o que impede o
 * assinante de reservar o mês todo e travar a cadeira.
 *
 * Datas saem de uma segunda-feira fixa em UTC — nada de new Date() no render,
 * para o servidor e o cliente nunca discordarem. A semana 0 é exatamente a
 * régua mockada em agenda.ts.
 */

const BASE = Date.UTC(2026, 6, 27); // segunda, 27 de julho de 2026
const DIA_MS = 86_400_000;

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MES_CURTO = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const MES_LONGO = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export type DiaDaSemana = {
  id: string;
  diaSemana: string;
  numero: string;
  mes: string;
  fechado: boolean;
};

const dataDe = (semana: number, indice: number) =>
  new Date(BASE + (semana * 7 + indice) * DIA_MS);

/** Os 7 dias da semana pedida. Os ids seguem d0..d6, de segunda a domingo. */
export function semanaDe(semana: number): DiaDaSemana[] {
  return Array.from({ length: 7 }, (_, i) => {
    const data = dataDe(semana, i);
    const diaDaSemana = data.getUTCDay();
    return {
      id: `d${i}`,
      diaSemana: SEMANA[diaDaSemana],
      numero: String(data.getUTCDate()).padStart(2, "0"),
      mes: MES_CURTO[data.getUTCMonth()],
      fechado: diaDaSemana === 0,
    };
  });
}

/** "27 de julho a 2 de agosto" */
export function periodoDa(semana: number) {
  const inicio = dataDe(semana, 0);
  const fim = dataDe(semana, 6);
  const mesInicio = MES_LONGO[inicio.getUTCMonth()];
  const mesFim = MES_LONGO[fim.getUTCMonth()];

  if (mesInicio === mesFim) {
    return `${inicio.getUTCDate()} a ${fim.getUTCDate()} de ${mesInicio}`;
  }
  return `${inicio.getUTCDate()} de ${mesInicio} a ${fim.getUTCDate()} de ${mesFim}`;
}

/** "segunda, 3 de agosto" — quando a próxima semana entra no ar. */
export function proximaAbertura(semana: number) {
  const segunda = dataDe(semana + 1, 0);
  return `segunda, ${segunda.getUTCDate()} de ${MES_LONGO[segunda.getUTCMonth()]}`;
}

/** "hoje", "amanhã" ou "sáb 01/ago". Só a semana corrente tem hoje e amanhã. */
export function rotuloDoDia(semana: number, diaId: string) {
  const dias = semanaDe(semana);
  const indice = dias.findIndex((d) => d.id === diaId);

  if (semana === 0 && indice === 0) return "hoje";
  if (semana === 0 && indice === 1) return "amanhã";

  const dia = dias[indice] ?? dias[0];
  return `${dia.diaSemana} ${dia.numero}/${dia.mes}`;
}
