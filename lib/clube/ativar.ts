import "server-only";

import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Liga ou renova a assinatura de alguém.
 *
 * Mora aqui, e não dentro da ação do painel, porque agora tem dois caminhos
 * para o mesmo fim: o Johny confirmando na mão depois do pix, e o webhook da
 * Stripe quando o cartão passa. Regra de ciclo duplicada em dois lugares vira
 * duas regras diferentes na primeira vez que uma delas mudar.
 *
 * O ciclo é contado em dias, não em "mês": o Johny vende 30 dias, e mês civil
 * daria 28 em fevereiro e 31 em março pelo mesmo dinheiro.
 */
export async function ativarAssinatura(entrada: {
  barbeariaId: string;
  clienteId: string;
  planoId: string;
}) {
  const supabase = clienteServico();

  // Preço e duração saem do plano, nunca do que veio de fora.
  const { data: plano } = await supabase
    .from("club_plans")
    .select("id, preco_centavos, duracao_dias")
    .eq("id", entrada.planoId)
    .eq("barbershop_id", entrada.barbeariaId)
    .eq("ativo", true)
    .maybeSingle();

  if (!plano) return { ok: false as const, erro: "plano_inexistente" };

  const hoje = new Date();
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + (plano.duracao_dias as number));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { data: existente } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("client_id", entrada.clienteId)
    .neq("status", "cancelada")
    .maybeSingle();

  const campos = {
    status: "ativa",
    plan_id: plano.id,
    preco_centavos: plano.preco_centavos,
    ciclo_inicio: iso(hoje),
    ciclo_fim: iso(fim),
    proxima_cobranca: iso(fim),
  };

  if (existente) {
    const { error } = await supabase
      .from("subscriptions")
      .update(campos)
      .eq("id", existente.id);

    if (error) return { ok: false as const, erro: error.message };
    return { ok: true as const, renovou: true, ate: iso(fim) };
  }

  const { error } = await supabase.from("subscriptions").insert({
    barbershop_id: entrada.barbeariaId,
    client_id: entrada.clienteId,
    cortes_mes: 0,
    ...campos,
  });

  if (error) return { ok: false as const, erro: error.message };
  return { ok: true as const, renovou: false, ate: iso(fim) };
}
