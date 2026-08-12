import "server-only";

import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Links de pagamento do PagBank, criados à mão no painel do Johny.
 *
 * É o caminho do cartão enquanto a API de pedidos não é liberada. Cada link
 * tem um valor fixo, então guardamos um por valor cobrado e procuramos pelo
 * valor exato do agendamento.
 *
 * Falhar aqui não pode custar um agendamento: qualquer erro devolve null, a
 * tela esconde o botão do cartão e o cliente segue no pix de sempre.
 */
export async function linkDoValor(
  barbeariaId: string,
  valorCentavos: number,
): Promise<string | null> {
  try {
    const { data } = await clienteServico()
      .from("payment_links")
      .select("url")
      .eq("barbershop_id", barbeariaId)
      .eq("valor_centavos", valorCentavos)
      .eq("ativo", true)
      .maybeSingle();

    return data?.url ?? null;
  } catch {
    return null;
  }
}

export type LinkDePagamento = {
  id: string;
  valorCentavos: number;
  url: string;
  rotulo: string | null;
  ativo: boolean;
};

/** Todos os links da casa, para a tela de ajustes. */
export async function linksDaCasa(
  barbeariaId: string,
): Promise<LinkDePagamento[]> {
  const { data } = await clienteServico()
    .from("payment_links")
    .select("id, valor_centavos, url, rotulo, ativo")
    .eq("barbershop_id", barbeariaId)
    .order("valor_centavos");

  return (data ?? []).map((l) => ({
    id: l.id as string,
    valorCentavos: l.valor_centavos as number,
    url: l.url as string,
    rotulo: (l.rotulo as string | null) ?? null,
    ativo: l.ativo as boolean,
  }));
}

/**
 * Valores que a casa realmente cobra, para o Johny não ficar adivinhando
 * quanto vale cada link: sai da tabela de serviços e dos planos do clube.
 */
export async function valoresCobrados(
  barbeariaId: string,
): Promise<{ valorCentavos: number; oQue: string }[]> {
  const supabase = clienteServico();

  const [servicos, planos] = await Promise.all([
    supabase
      .from("services")
      .select("nome, preco_centavos")
      .eq("barbershop_id", barbeariaId)
      .eq("ativo", true),
    supabase
      .from("club_plans")
      .select("nome, preco_centavos")
      .eq("barbershop_id", barbeariaId)
      .eq("ativo", true),
  ]);

  // Vários serviços custam o mesmo, e o link é por valor: agrupa por preço e
  // lista o que cai naquele valor.
  const porValor = new Map<number, string[]>();

  for (const s of servicos.data ?? []) {
    const v = s.preco_centavos as number;
    if (v > 0) porValor.set(v, [...(porValor.get(v) ?? []), s.nome as string]);
  }
  for (const p of planos.data ?? []) {
    const v = p.preco_centavos as number;
    if (v > 0) {
      porValor.set(v, [...(porValor.get(v) ?? []), `Clube · ${p.nome}`]);
    }
  }

  return [...porValor.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([valorCentavos, nomes]) => ({
      valorCentavos,
      oQue: nomes.join(", "),
    }));
}
