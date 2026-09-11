import "server-only";

import { hojeNaCasa } from "@/lib/agenda/dias";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * O que o mural da bancada mostra.
 *
 * Leitura própria, e não a do painel, porque o recorte é outro: aqui não entra
 * valor, telefone nem forma de pagamento. O tablet fica à vista de quem espera,
 * e o que não é lido aqui não vaza por cima do balcão.
 */

export type NoMural = {
  id: string;
  inicio: string;
  fim: string;
  hora: string;
  /** Formatada igual à de início: o mural compara hora com hora. */
  horaFim: string;
  cliente: string;
  servico: string;
  status: string;
  /** Assinante não paga na hora: o barbeiro não precisa cobrar nada. */
  clube: boolean;
};

export type ColunaDoMural = {
  barbeiroId: string;
  nome: string;
  foto: string | null;
  marcados: NoMural[];
};

export async function muralDoDia(token: string, dia = hojeNaCasa()) {
  if (!/^[a-f0-9]{32}$/i.test(token)) return null;

  const supabase = clienteServico();

  const { data: casa } = await supabase
    .from("barbershops")
    .select("id, nome")
    .eq("mural_token", token)
    .maybeSingle();

  if (!casa) return null;

  const [{ data: barbeiros }, { data: marcados }] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, apelido, foto_url")
      .eq("barbershop_id", casa.id)
      .eq("ativo", true)
      .order("ordem"),
    supabase
      .from("appointments")
      .select(
        "id, inicio, fim, status, barber_id, usou_credito_clube, clients(nome), services!service_id(nome)",
      )
      .eq("barbershop_id", casa.id)
      .gte("inicio", `${dia}T00:00:00-03:00`)
      .lt("inicio", `${dia}T23:59:59-03:00`)
      // Cancelado e expirado não são trabalho de ninguém: mostrar riscado
      // encheria a coluna de linha morta no fim do dia.
      .in("status", ["confirmado", "concluido", "pendente_pagamento", "faltou"])
      .order("inicio"),
  ]);

  const um = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", {
      timeZone: "America/Fortaleza",
      hour: "2-digit",
      minute: "2-digit",
    });

  const colunas: ColunaDoMural[] = (barbeiros ?? []).map((b) => ({
    barbeiroId: b.id as string,
    nome: b.apelido as string,
    foto: (b.foto_url as string | null) ?? null,
    marcados: (marcados ?? [])
      .filter((a) => a.barber_id === b.id)
      .map((a) => ({
        id: a.id as string,
        inicio: a.inicio as string,
        fim: a.fim as string,
        hora: hora(a.inicio as string),
        horaFim: hora(a.fim as string),
        cliente: um<{ nome: string }>(a.clients as never)?.nome ?? "—",
        servico: um<{ nome: string }>(a.services as never)?.nome ?? "",
        status: a.status as string,
        clube: Boolean(a.usou_credito_clube),
      })),
  }));

  return { casa: casa.nome as string, dia, colunas };
}
