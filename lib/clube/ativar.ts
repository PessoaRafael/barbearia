import "server-only";

import { hojeNaCasa } from "@/lib/agenda/dias";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Liga ou renova a assinatura de alguém.
 *
 * Mora aqui, e não dentro da ação do painel, porque são vários caminhos para
 * o mesmo fim: o Johny confirmando na mão depois do pix, o webhook da Stripe
 * quando o cartão passa, e a InfinitePay. Regra de ciclo duplicada em dois
 * lugares vira duas regras diferentes na primeira vez que uma delas mudar.
 *
 * O ciclo é contado em dias, não em "mês": o Johny vende 30 dias, e mês civil
 * daria 28 em fevereiro e 31 em março pelo mesmo dinheiro.
 */
export async function ativarAssinatura(entrada: {
  barbeariaId: string;
  clienteId: string;
  planoId: string;
  /**
   * Pagou antes de vencer: o mês novo começa onde o atual termina.
   *
   * No "Renovar" do painel quem decide o dia é o Johny, que espera vencer ou
   * acerta a data na mão. Pagamento que confirma sozinho não tem ninguém
   * olhando, e contar do dia do pagamento comeria os dias que o assinante já
   * tinha pago. A landing promete "adiantar a próxima mensalidade".
   */
  somarAoQueFalta?: boolean;
}) {
  const supabase = clienteServico();

  // Preço e duração saem do plano, nunca do que veio de fora.
  const { data: plano } = await supabase
    .from("club_plans")
    .select("id, preco_centavos, duracao_dias, ativo")
    .eq("id", entrada.planoId)
    .eq("barbershop_id", entrada.barbeariaId)
    .maybeSingle();

  if (!plano) return { ok: false as const, erro: "plano_inexistente" };

  const { data: existente } = await supabase
    .from("subscriptions")
    .select("id, status, plan_id, ciclo_fim")
    .eq("client_id", entrada.clienteId)
    .neq("status", "cancelada")
    .maybeSingle();

  /**
   * Plano fora de venda serve só para quem já está nele.
   *
   * Dez assinantes seguem em planos que o Johny tirou da landing. Exigir
   * plano ativo aqui deixava esses dez sem conseguir renovar sozinhos, e a
   * mensalidade deles voltava a depender do "Renovar".
   */
  if (!plano.ativo && existente?.plan_id !== plano.id) {
    return { ok: false as const, erro: "plano_inexistente" };
  }

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const base =
    entrada.somarAoQueFalta &&
    existente?.status === "ativa" &&
    (existente.ciclo_fim as string) >= hojeNaCasa()
      ? (existente.ciclo_fim as string)
      : iso(new Date());

  const fim = new Date(`${base}T12:00:00Z`);
  fim.setUTCDate(fim.getUTCDate() + (plano.duracao_dias as number));

  const campos = {
    status: "ativa",
    plan_id: plano.id,
    preco_centavos: plano.preco_centavos,
    ciclo_inicio: base,
    ciclo_fim: iso(fim),
    proxima_cobranca: iso(fim),
    // Mês pago apaga o "Desfazer" do último Renovar. Desfazer depois disso
    // devolveria o ciclo de antes e jogaria fora um mês que entrou dinheiro.
    ciclo_anterior_inicio: null,
    ciclo_anterior_fim: null,
    status_anterior: null,
    renovada_em: null,
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
