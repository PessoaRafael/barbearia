import { NextResponse, type NextRequest } from "next/server";

import { provedorAtual } from "@/lib/payments/provider";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Aviso do PagBank de que um pedido mudou de estado.
 *
 * O corpo que chega serve para uma coisa só: saber QUAL pedido mexeu. Quem
 * diz se foi pago é o próprio PagBank, numa consulta que o servidor faz. Por
 * isso a rota não depende de conferir assinatura para ser segura — quem
 * descobrir o endereço e mandar um "pago" falso não consegue nada, porque a
 * confirmação exige que o PagBank confirme.
 *
 * Responde 200 mesmo quando ignora. Provedor que recebe erro fica reenviando,
 * e o reenvio de algo que já resolvemos não ajuda ninguém.
 */
export const dynamic = "force-dynamic";

export async function POST(requisicao: NextRequest) {
  const provedor = provedorAtual();

  if (!provedor.confirmaSozinho) {
    return NextResponse.json({ ignorado: "provedor manual" });
  }

  let corpo: unknown = null;
  try {
    corpo = await requisicao.json();
  } catch {
    return NextResponse.json({ ignorado: "corpo ilegível" });
  }

  const aviso = await provedor.webhook(corpo).catch(() => null);
  if (!aviso) return NextResponse.json({ ignorado: "sem pedido" });

  if (aviso.status !== "confirmado") {
    // Pedido criado, expirado, negado: nada a fazer aqui. Expirar já é
    // trabalho do cron, que devolve o horário para a grade.
    return NextResponse.json({ txid: aviso.txid, status: aviso.status });
  }

  const { data, error } = await clienteServico().rpc("confirmar_pix", {
    p_txid: aviso.txid,
  });

  if (error) {
    // Vale gritar no log: pagamento confirmado no banco deles e não registrado
    // aqui é a pior combinação possível, o cliente pagou e não tem horário.
    console.error("webhook pagbank", aviso.txid, error.message);
    return NextResponse.json({ erro: "falhou ao registrar" }, { status: 500 });
  }

  return NextResponse.json({ txid: aviso.txid, ...(data as object) });
}

/** Alguns provedores testam o endereço com GET antes de mandar aviso. */
export async function GET() {
  return NextResponse.json({ pronto: true });
}
