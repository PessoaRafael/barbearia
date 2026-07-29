import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Derruba o cache das páginas públicas.
 *
 * O painel já revalida sozinho quando salva, mas mudança feita fora do app
 * (script, SQL direto no Supabase) não avisa ninguém, e a tela fica mostrando
 * dado velho sem nada aparentemente errado. Este endpoint é a saída para
 * esses casos.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" .../api/revalidar
 */

export const dynamic = "force-dynamic";

const PUBLICAS = ["/", "/bot", "/agendar"];

export async function GET(requisicao: NextRequest) {
  const segredo = process.env.CRON_SECRET;

  if (!segredo || requisicao.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  for (const rota of PUBLICAS) revalidatePath(rota);

  return NextResponse.json({ revalidadas: PUBLICAS });
}
