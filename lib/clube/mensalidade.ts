import "server-only";

import { hojeNaCasa } from "@/lib/agenda/dias";
import { casa } from "@/lib/dados/casa";
import { clienteServico } from "@/lib/supabase/servidor";

export type Mensalidade = {
  barbeariaId: string;
  nome: string;
  /** Nulo: nunca assinou, só pediu para entrar e não pagou ainda. */
  assinatura: { emDia: boolean; ate: string } | null;
  /** O que dá para pagar agora. Nulo quando não há plano que sirva. */
  plano: { id: string; nome: string; precoCentavos: number } | null;
};

/**
 * Como está a mensalidade de um cliente, para a página de pagar.
 *
 * O plano cobrado é o da assinatura, mesmo que o Johny tenha tirado ele da
 * landing: dez assinantes estão em planos assim, e mudar o plano de alguém
 * só porque ele foi pagar seria trocar o combinado sem perguntar. Quem ainda
 * não é do clube paga o plano que escolheu na landing, e só se ele continua
 * à venda.
 */
export async function mensalidadeDe(clienteId: string): Promise<Mensalidade | null> {
  const barbearia = await casa();
  const supabase = clienteServico();

  const { data: cliente } = await supabase
    .from("clients")
    .select("nome")
    .eq("id", clienteId)
    .eq("barbershop_id", barbearia.id)
    .maybeSingle();
  if (!cliente) return null;

  const { data: assin } = await supabase
    .from("subscriptions")
    .select("status, ciclo_fim, club_plans(id, nome, preco_centavos)")
    .eq("client_id", clienteId)
    .neq("status", "cancelada")
    .maybeSingle();

  const um = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  let plano = um(
    assin?.club_plans as
      | { id: string; nome: string; preco_centavos: number }
      | null
      | undefined,
  );

  if (!assin) {
    const { data: pedido } = await supabase
      .from("cobrancas_do_clube")
      .select("club_plans(id, nome, preco_centavos, ativo)")
      .eq("client_id", clienteId)
      .order("criada_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const escolhido = um(
      pedido?.club_plans as
        | { id: string; nome: string; preco_centavos: number; ativo: boolean }
        | null
        | undefined,
    );
    plano = escolhido?.ativo ? escolhido : null;
    if (!plano) return null;
  }

  return {
    barbeariaId: barbearia.id,
    nome: cliente.nome as string,
    assinatura: assin
      ? {
          emDia:
            assin.status === "ativa" && (assin.ciclo_fim as string) >= hojeNaCasa(),
          ate: assin.ciclo_fim as string,
        }
      : null,
    plano: plano
      ? { id: plano.id, nome: plano.nome, precoCentavos: plano.preco_centavos }
      : null,
  };
}
