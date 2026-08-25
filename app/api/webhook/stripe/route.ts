import { NextResponse } from "next/server";

import { ativarAssinatura } from "@/lib/clube/ativar";
import { assinaturaConfere, marcasDaSessao } from "@/lib/payments/stripe";
import { clienteServico } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

/**
 * A Stripe avisando que alguém pagou no cartão.
 *
 * Duas conferências antes de mexer em qualquer coisa:
 *
 *   1. a assinatura do corpo, com o segredo que só nós dois conhecemos
 *   2. o status da cobrança, perguntando de volta para a Stripe
 *
 * A segunda parece redundante depois da primeira, e é de propósito. Confirmar
 * horário é dar cadeira: se algum dia o segredo vazar, quem tiver a chave
 * ainda vai precisar de uma cobrança que a Stripe reconheça como paga.
 *
 * Sempre devolve 200 quando o aviso é legítimo, mesmo se não houver o que
 * fazer. Erro faz a Stripe reenviar por dias, e reenvio de aviso que já foi
 * tratado não ajuda ninguém.
 */
export async function POST(req: Request) {
  // Texto cru: reserializar o JSON muda um espaço e a assinatura não bate.
  const corpo = await req.text();

  if (!assinaturaConfere(corpo, req.headers.get("stripe-signature"))) {
    console.warn("stripe: aviso com assinatura que não confere, ignorado");
    return NextResponse.json({ erro: "assinatura" }, { status: 400 });
  }

  let evento: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    evento = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ erro: "corpo" }, { status: 400 });
  }

  /**
   * Assinatura recorrente: três avisos que chegam sem ninguém pedir.
   *
   * Não passam pela conferência de sessão porque não são sessão — vêm da
   * fatura e da assinatura. O corpo já está assinado, e o id que a gente usa
   * para achar a assinatura é o da Stripe, que só ela conhece.
   */
  if (
    evento.type === "invoice.paid" ||
    evento.type === "invoice.payment_failed" ||
    evento.type === "customer.subscription.deleted"
  ) {
    return await tratarAssinatura(evento.type, evento.data?.object ?? {});
  }

  if (evento.type !== "checkout.session.completed") {
    return NextResponse.json({ ignorado: evento.type });
  }

  const sessao = evento.data?.object ?? {};
  const sessaoId = sessao.id as string | undefined;
  if (!sessaoId) return NextResponse.json({ ignorado: "sem id" });

  // Pergunta de volta em vez de acreditar no que veio no corpo. As marcas
  // vêm da mesma consulta: é o metadata da Stripe, não o do corpo recebido.
  let marcas: Awaited<ReturnType<typeof marcasDaSessao>>;
  try {
    marcas = await marcasDaSessao(sessaoId);
  } catch (erro) {
    // Não conseguimos conferir: melhor a Stripe reenviar do que confirmar no
    // escuro. Aqui o 500 é proposital.
    console.error("stripe: falha ao conferir a sessão:", (erro as Error).message);
    return NextResponse.json({ erro: "conferencia" }, { status: 500 });
  }

  if (!marcas.paga) {
    console.warn("stripe: sessão avisada como completa mas não paga:", sessaoId);
    return NextResponse.json({ ignorado: "não paga" });
  }

  /**
   * Mensalidade do clube, não horário.
   *
   * O carimbo vem da consulta à Stripe, não do corpo do aviso — o corpo até
   * está assinado, mas quem decide ligar assinatura tem que ler da fonte.
   */
  if (marcas.metadata.tipo === "clube" || marcas.metadata.tipo === "assinatura") {
    const r = await ativarAssinatura({
      barbeariaId: marcas.metadata.barbearia,
      clienteId: marcas.metadata.cliente,
      planoId: marcas.metadata.plano,
    });

    if (!r.ok) {
      console.error("stripe clube: não consegui ativar", sessaoId, r.erro);
      return NextResponse.json({ erro: "assinatura" }, { status: 500 });
    }

    /**
     * Recorrente: guarda o vínculo com a Stripe.
     *
     * É por esse id que as renovações dos próximos meses vão encontrar a
     * assinatura. Sem ele, daqui a 30 dias chegaria uma fatura paga que o
     * sistema não saberia de quem é.
     */
    if (marcas.assinatura) {
      await clienteServico()
        .from("subscriptions")
        .update({
          stripe_subscription_id: marcas.assinatura,
          stripe_customer_id: marcas.clienteStripe,
          cancela_no_fim: false,
        })
        .eq("client_id", marcas.metadata.cliente)
        .neq("status", "cancelada");
    }

    return NextResponse.json({
      ok: true,
      clube: true,
      ate: r.ate,
      recorrente: Boolean(marcas.assinatura),
    });
  }

  const supabase = clienteServico();

  // A função é a mesma do pix e acha a cobrança pelo txid. Ela é idempotente:
  // avisada duas vezes, a segunda sai sem lançar nada de novo.
  const { data, error } = await supabase.rpc("confirmar_pix", { p_txid: sessaoId });

  if (error) {
    console.error("stripe: não consegui confirmar", sessaoId, error.message);
    return NextResponse.json({ erro: "confirmacao" }, { status: 500 });
  }

  const agendamento = (data as { agendamento?: string } | null)?.agendamento;

  /**
   * Pagou no cartão: o pix daquele horário não espera mais.
   *
   * Sem isto, a linha do pix ficaria "aguardando" para sempre e o horário
   * apareceria na aba Pix do painel como se faltasse dinheiro — o Johny iria
   * atrás de um pagamento que já entrou por outro caminho.
   */
  if (agendamento) {
    await supabase
      .from("payments")
      .update({ status: "expirado" })
      .eq("appointment_id", agendamento)
      .eq("status", "aguardando")
      .neq("txid", sessaoId);
  }

  return NextResponse.json({ ok: true, agendamento });
}

/**
 * Os avisos da assinatura recorrente.
 *
 * Cada um mexe em uma coisa só, e nenhum deles cancela por conta própria:
 *
 *   invoice.paid                  empurra o ciclo
 *   invoice.payment_failed        marca vencida, e a Stripe segue tentando
 *   customer.subscription.deleted encerra, que é quando ela desistiu de vez
 *
 * Falha de cartão não cancela de propósito: quem só trocou de cartão perderia
 * o clube por um problema de banco. Vencido paga o corte no valor normal até
 * acertar, que é a mesma regra do pix atrasado.
 */
async function tratarAssinatura(tipo: string, objeto: Record<string, unknown>) {
  const supabase = clienteServico();

  if (tipo === "customer.subscription.deleted") {
    const id = objeto.id as string | undefined;
    if (!id) return NextResponse.json({ ignorado: "sem id" });

    const { error } = await supabase.rpc("encerrar_assinatura", {
      p_stripe_id: id,
    });
    if (error) {
      console.error("stripe: não consegui encerrar", id, error.message);
      return NextResponse.json({ erro: "encerrar" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, encerrada: id });
  }

  // Nas faturas, a assinatura vem no campo `subscription`.
  const assinatura = objeto.subscription as string | undefined;
  if (!assinatura) return NextResponse.json({ ignorado: "fatura sem assinatura" });

  if (tipo === "invoice.payment_failed") {
    const { error } = await supabase.rpc("falhou_cobranca", {
      p_stripe_id: assinatura,
    });
    if (error) {
      console.error("stripe: falha ao marcar vencida", assinatura, error.message);
      return NextResponse.json({ erro: "vencida" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, vencida: assinatura });
  }

  /**
   * Até quando o período pago vale, vindo da própria fatura. Sem isso a gente
   * chutaria trinta dias a partir de hoje, e o ciclo iria escorregando um
   * pouco todo mês até não bater mais com a cobrança.
   */
  const linha = (objeto.lines as { data?: { period?: { end?: number } }[] } | undefined)
    ?.data?.[0];
  const fim = linha?.period?.end;
  const ate = fim ? new Date(fim * 1000).toISOString().slice(0, 10) : null;

  const { data, error } = await supabase.rpc("renovar_assinatura", {
    p_stripe_id: assinatura,
    p_ate: ate,
  });

  if (error) {
    console.error("stripe: não consegui renovar", assinatura, error.message);
    return NextResponse.json({ erro: "renovar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, renovacao: data });
}
