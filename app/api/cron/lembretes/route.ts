import { NextResponse, type NextRequest } from "next/server";

import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Enfileira os lembretes do dia e marca as mensalidades vencidas.
 *
 * Roda uma vez por manhã, não de hora em hora: o plano Hobby da Vercel só
 * aceita cron diário. Como a mensagem fica numa fila para o Johny disparar no
 * wa.me, juntar o dia inteiro de uma vez funciona melhor do que pingar de hora
 * em hora, ele abre a fila e manda tudo.
 */

export const dynamic = "force-dynamic";

export async function GET(requisicao: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || requisicao.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const supabase = clienteServico();

  // lembrete_horas fica no banco para quando houver API oficial de WhatsApp e
  // der para disparar na hora exata. No digest diário ele não é usado.
  const { data: casas } = await supabase.from("barbershops").select("id");

  let enfileirados = 0;

  for (const casa of casas ?? []) {
    // Daqui até o fim do expediente de hoje, no fuso da casa.
    const de = new Date();
    const hoje = new Date(
      de.toLocaleString("en-US", { timeZone: "America/Fortaleza" }),
    );
    const ate = new Date(de);
    ate.setUTCHours(ate.getUTCHours() + (24 - hoje.getHours()));

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
