/**
 * Régua de dias do agendamento.
 *
 * Calculada no servidor, no fuso da casa, e mandada pronta para a tela. Nada
 * de new Date() dentro do render: servidor em UTC e celular em Natal não podem
 * discordar sobre que dia é hoje.
 */

const FUSO = "America/Fortaleza";
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const MES_LONGO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export type Dia = {
  data: string;
  diaSemana: string;
  numero: string;
  mes: string;
  fechado: boolean;
  rotulo: string | null;
};

/** "2026-07-29", hoje na barbearia, não no servidor da Vercel. */
export function hojeNaCasa() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function proximosDias(quantidade = 7): Dia[] {
  const [ano, mes, dia] = hojeNaCasa().split("-").map(Number);

  return Array.from({ length: quantidade }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 1, dia + i));
    const semana = d.getUTCDay();

    return {
      data: d.toISOString().slice(0, 10),
      diaSemana: SEMANA[semana],
      numero: String(d.getUTCDate()).padStart(2, "0"),
      mes: MES[d.getUTCMonth()],
      fechado: semana === 0,
      rotulo: i === 0 ? "hoje" : i === 1 ? "amanhã" : null,
    };
  });
}

/** "29 de julho a 4 de agosto", o mês uma vez só, em vez de sete. */
export function periodo(dias: Dia[]) {
  if (!dias.length) return "";
  const primeiro = dias[0];
  const ultimo = dias[dias.length - 1];

  const nome = (d: Dia) => MES_LONGO[MES.indexOf(d.mes)];
  const numero = (d: Dia) => Number(d.numero);

  if (primeiro.mes === ultimo.mes) {
    return `${numero(primeiro)} a ${numero(ultimo)} de ${nome(primeiro)}`;
  }
  return `${numero(primeiro)} de ${nome(primeiro)} a ${numero(ultimo)} de ${nome(ultimo)}`;
}

export function rotuloDe(dia: Dia) {
  return dia.rotulo ?? `${dia.diaSemana} ${dia.numero}/${dia.mes}`;
}
