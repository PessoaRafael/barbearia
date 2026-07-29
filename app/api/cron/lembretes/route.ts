import { NextResponse, type NextRequest } from "next/server";

import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Enfileira o lembrete de quem corta daqui a pouco e marca as mensalidades
 * vencidas. Roda de hora em hora.
 */

export const dynamic = "force-dynamic";

export async function GET(requisicao: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || requisicao.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const supabase = clienteServico();

  const { data: casas } = await supabase
    .from("barbershops")
    .select("id, lembrete_horas");

  let enfileirados = 0;

  for (const casa of casas ?? []) {
    const de = new Date(Date.now() + casa.lembrete_horas * 60 * 60 * 1000);
    const ate = new Date(de.getTime() + 60 * 60 * 1000);

    const { data: proximos } = await supabase
      .from("appointments")
      .select("id, inicio, clients(nome, telefone), services(nome), barbers(apelido)")
      .eq("barbershop_id", casa.id)
      .eq("status", "confirmado")
      .gte("inicio", de.toISOString())
      .lt("inicio", ate.toISOString());

    for (const item of proximos ?? []) {
      // Um lembrete por agendamento: o payload guarda o id para conferir.
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("template", "lembrete")
        .eq("payload->>agendamento", item.id);

      if (count) continue;

      const cliente = Array.isArray(item.clients) ? item.clients[0] : item.clients;
      const servico = Array.isArray(item.services) ? item.services[0] : item.services;
      const barbeiro = Array.isArray(item.barbers) ? item.barbers[0] : item.barbers;

      await supabase.from("notifications").insert({
        barbershop_id: casa.id,
        destino: "cliente",
        template: "lembrete",
        telefone: cliente?.telefone ?? null,
        payload: {
          agendamento: item.id,
          cliente: cliente?.nome?.split(" ")[0] ?? "",
          servico: servico?.nome ?? "",
          barbeiro: barbeiro?.apelido ?? "",
          quando: new Date(item.inicio).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Fortaleza",
          }),
        },
      });

      enfileirados++;
    }
  }

  const { data: vencidas } = await supabase.rpc("vencer_assinaturas");

  return NextResponse.json({ enfileirados, vencidas: vencidas ?? 0 });
}
