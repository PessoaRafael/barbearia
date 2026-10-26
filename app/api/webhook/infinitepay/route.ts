import { NextResponse } from "next/server";

import { confirmarPelaInfinitepay, lerVolta } from "@/lib/payments/infinitepay";

export const dynamic = "force-dynamic";

/**
 * A InfinitePay avisando que um pagamento passou.
 *
 * O aviso não é assinado, então ele só serve de gatilho: quem decide é o
 * payment_check, dentro de `confirmarPelaInfinitepay`.
 *
 * Respondendo 400, ela manda de novo. Só vale quando repetir pode dar certo
 * (a conferência caiu, o banco falhou); aviso falso ou já tratado volta 200.
 */
export async function POST(req: Request) {
  const texto = await req.text();

  // JSON é o esperado; formulário entra pelo mesmo caminho para um aviso não
  // se perder só pelo formato.
  let corpo: Record<string, unknown>;
  try {
    corpo = JSON.parse(texto);
  } catch {
    corpo = Object.fromEntries(new URLSearchParams(texto));
  }

  const volta = lerVolta(corpo ?? {});
  if (!volta) return NextResponse.json({ ignorado: "sem pedido" });

  const r = await confirmarPelaInfinitepay(volta);
  if (!r.ok && r.repetir) {
    return NextResponse.json({ erro: r.motivo }, { status: 400 });
  }
  return NextResponse.json(r);
}
