import "server-only";

import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Disponibilidade calculada no servidor, sempre.
 *
 * O navegador nunca decide se um horário está livre — ele só desenha o que
 * chega daqui, e a reserva confere tudo de novo dentro da transação.
 *
 * Natal não tem horário de verão desde 2019, então o fuso é fixo em -03:00.
 * Assim a conta não depende do relógio do servidor da Vercel, que roda em UTC.
 */

export const FUSO = "-03:00";
export const PASSO_MIN = 30;

export type Livre = { hora: string; barbeiros: string[] };

export const emMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

export const emHora = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(
    minutos % 60,
  ).padStart(2, "0")}`;

/** "2026-07-28" + "09:00" -> instante absoluto no fuso da barbearia. */
export function instante(data: string, hora: string) {
  return new Date(`${data}T${hora}:00${FUSO}`);
}

/** Dia da semana (0-6) da data, no fuso da casa e não no do servidor. */
export function diaDaSemana(data: string) {
  return new Date(`${data}T12:00:00${FUSO}`).getUTCDay();
}

function sobrepoe(
  inicioA: number,
  fimA: number,
  inicioB: number,
  fimB: number,
) {
  return inicioA < fimB && inicioB < fimA;
}

/**
 * Devolve à grade o pix que estourou o prazo.
 *
 * Roda junto com a consulta de disponibilidade em vez de depender de um cron
 * de minuto em minuto — que o plano Hobby da Vercel não aceita. O horário só
 * precisa voltar quando alguém for olhar a grade, e é exatamente aí que isto
 * acontece. O cron diário fica como rede de segurança.
 */
async function devolverPixVencido() {
  try {
    await clienteServico().rpc("expirar_pendentes");
  } catch {
    // Não é motivo para derrubar a consulta: no pior caso um horário
    // continua preso até a próxima chamada.
  }
}

export async function horariosLivres(entrada: {
  barbeariaId: string;
  data: string;
  duracaoMin: number;
  barbeiroId?: string | null;
}): Promise<Livre[]> {
  const { barbeariaId, data, duracaoMin } = entrada;
  const supabase = clienteServico();
  const dow = diaDaSemana(data);

  await devolverPixVencido();

  const { data: fechado } = await supabase
    .from("closures")
    .select("id")
    .eq("barbershop_id", barbeariaId)
    .eq("data", data)
    .maybeSingle();
  if (fechado) return [];

  let barbeiros = supabase
    .from("barbers")
    .select("id")
    .eq("barbershop_id", barbeariaId)
    .eq("ativo", true);
  if (entrada.barbeiroId) barbeiros = barbeiros.eq("id", entrada.barbeiroId);

  const { data: equipe } = await barbeiros;
  if (!equipe?.length) return [];

  const ids = equipe.map((b) => b.id);

  const [{ data: expediente }, { data: pausas }, { data: marcados }] =
    await Promise.all([
      supabase
        .from("working_hours")
        .select("barber_id, abre, fecha")
        .in("barber_id", ids)
        .eq("dia_semana", dow)
        .eq("ativo", true),
      supabase
        .from("breaks")
        .select("barber_id, inicio, fim, dia_semana, data")
        .in("barber_id", ids)
        .or(`dia_semana.eq.${dow},data.eq.${data}`),
      supabase
        .from("appointments")
        .select("barber_id, inicio, fim")
        .in("barber_id", ids)
        .in("status", ["pendente_pagamento", "confirmado", "concluido"])
        .gte("inicio", instante(data, "00:00").toISOString())
        .lt("inicio", instante(data, "23:59").toISOString()),
    ]);

  const agora = Date.now();
  const porHora = new Map<string, string[]>();

  for (const barbeiro of ids) {
    const turno = expediente?.find((e) => e.barber_id === barbeiro);
    if (!turno) continue;

    const abre = emMinutos(turno.abre.slice(0, 5));
    const fecha = emMinutos(turno.fecha.slice(0, 5));

    const ocupado: Array<[number, number]> = [];

    for (const pausa of pausas ?? []) {
      if (pausa.barber_id !== barbeiro) continue;
      ocupado.push([
        emMinutos(pausa.inicio.slice(0, 5)),
        emMinutos(pausa.fim.slice(0, 5)),
      ]);
    }

    for (const marca of marcados ?? []) {
      if (marca.barber_id !== barbeiro) continue;
      const inicio = new Date(marca.inicio);
      const fim = new Date(marca.fim);
      const base = instante(data, "00:00").getTime();
      ocupado.push([
        Math.round((inicio.getTime() - base) / 60000),
        Math.round((fim.getTime() - base) / 60000),
      ]);
    }

    for (let comeco = abre; comeco + duracaoMin <= fecha; comeco += PASSO_MIN) {
      const termino = comeco + duracaoMin;

      const colide = ocupado.some(([i, f]) => sobrepoe(comeco, termino, i, f));
      if (colide) continue;

      // Nada no passado, nem por um minuto.
      if (instante(data, emHora(comeco)).getTime() <= agora) continue;

      const hora = emHora(comeco);
      porHora.set(hora, [...(porHora.get(hora) ?? []), barbeiro]);
    }
  }

  return [...porHora.entries()]
    .map(([hora, barbeiros]) => ({ hora, barbeiros }))
    .sort((a, b) => emMinutos(a.hora) - emMinutos(b.hora));
}

/**
 * "Tanto faz": fica com quem tem menos corte marcado no dia, para a carga não
 * cair sempre no mesmo.
 */
export async function menosOcupado(
  barbeariaId: string,
  data: string,
  candidatos: string[],
) {
  if (candidatos.length === 1) return candidatos[0];

  const supabase = clienteServico();
  const { data: marcados } = await supabase
    .from("appointments")
    .select("barber_id")
    .eq("barbershop_id", barbeariaId)
    .in("barber_id", candidatos)
    .in("status", ["pendente_pagamento", "confirmado", "concluido"])
    .gte("inicio", instante(data, "00:00").toISOString())
    .lt("inicio", instante(data, "23:59").toISOString());

  const conta = new Map(candidatos.map((id) => [id, 0]));
  for (const m of marcados ?? []) {
    conta.set(m.barber_id, (conta.get(m.barber_id) ?? 0) + 1);
  }

  return [...conta.entries()].sort((a, b) => a[1] - b[1])[0][0];
}
