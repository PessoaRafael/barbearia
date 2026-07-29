import { NextResponse, type NextRequest } from "next/server";

import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Devolve à grade o horário de quem não pagou dentro do prazo.
 * A Vercel chama a cada minuto (ver vercel.json).
 */

export const dynamic = "force-dynamic";

function autorizado(requisicao: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  return requisicao.headers.get("authorization") === `Bearer ${segredo}`;
}

export async function GET(requisicao: NextRequest) {
  if (!autorizado(requisicao)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const supabase = clienteServico();
  const { data, error } = await supabase.rpc("expirar_pendentes");

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ expirados: data ?? 0 });
}
