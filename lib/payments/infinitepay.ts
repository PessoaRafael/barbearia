import "server-only";

import { randomBytes } from "node:crypto";

import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Pix e cartão pela InfinitePay.
 *
 * O pix direto na chave do Johny não tem taxa, mas só confirma quando ele
 * confere o extrato e toca em "Recebi": pago de noite, o horário vence com o
 * dinheiro já na conta. Na InfinitePay o pix também sai sem taxa, e ela avisa
 * sozinha quando cai. O cartão passa a sair por ela também, no lugar da
 * Stripe.
 *
 * Checkout por link, igual ao Hub da ArqRede: só a InfiniteTag do Johny, sem
 * chave secreta. A página de pagamento é deles, e número de cartão nunca passa
 * por aqui.
 *
 * O aviso que eles mandam não é assinado. Por isso nada confirma pelo que veio
 * no corpo: tudo passa pelo payment_check, que pergunta de volta se aquele
 * pagamento existe, foi pago e quanto.
 */

const API = "https://api.checkout.infinitepay.io";

// A tag aparece no app com $ na frente; a API quer sem.
function tag() {
  return (process.env.INFINITEPAY_HANDLE ?? "").trim().replace(/^\$/, "");
}

/** Duas chaves, como no PagBank e na Stripe: a tag existir não liga sozinha. */
export function infinitepayLigado() {
  return process.env.INFINITEPAY_ATIVO === "true" && Boolean(tag());
}

/**
 * Link de pagamento para um horário, já com a linha em `payments`.
 *
 * O order_nsu vira o txid da linha: é por ele que o aviso e a volta acham o
 * horário. Cada toque gera um link novo, e link que ninguém pagou não custa
 * nada nem aparece no extrato de ninguém.
 */
export async function cobrarNaInfinitepay(entrada: {
  barbeariaId: string;
  agendamentoId: string;
  tokenCliente: string;
  valorCentavos: number;
  /** "Corte + Barba": é o que o cliente lê na página de pagamento. */
  descricao: string;
  clienteNome: string;
  clienteEmail?: string | null;
  /** O prazo da reserva. A linha morre junto com ela. */
  expiraEm: Date | string | null;
}): Promise<string> {
  const site = process.env.SITE_URL?.replace(/\/$/, "");
  if (!site) throw new Error("infinitepay: sem SITE_URL");

  const pedido = `IP${entrada.agendamentoId.replace(/-/g, "")}${randomBytes(3).toString("hex")}`;

  const r = await fetch(`${API}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: tag(),
      items: [
        { quantity: 1, price: entrada.valorCentavos, description: entrada.descricao },
      ],
      order_nsu: pedido,
      // A volta cai no link do cliente, que confere e confirma por conta
      // própria se o aviso ainda não tiver chegado.
      redirect_url: `${site}/meu-agendamento/${entrada.tokenCliente}`,
      webhook_url: `${site}/api/webhook/infinitepay`,
      ...(entrada.clienteEmail
        ? { customer: { name: entrada.clienteNome, email: entrada.clienteEmail } }
        : {}),
    }),
    // A cobrança nasce com o horário já gravado: travar aqui seguraria o
    // cliente olhando a tela em vez de cair no pix de sempre.
    signal: AbortSignal.timeout(10_000),
  });

  const dados = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  const url = dados.url ?? dados.link ?? dados.checkout_url;
  if (!r.ok || typeof url !== "string") {
    throw new Error(`infinitepay_${r.status}: ${JSON.stringify(dados).slice(0, 200)}`);
  }

  // Confere o que voltou: sem a linha, o aviso chegaria e não acharia de quem
  // é o dinheiro.
  const { error } = await clienteServico().from("payments").insert({
    barbershop_id: entrada.barbeariaId,
    appointment_id: entrada.agendamentoId,
    metodo: "infinitepay",
    valor_centavos: entrada.valorCentavos,
    status: "aguardando",
    txid: pedido,
    expira_em: entrada.expiraEm,
  });
  if (error) throw new Error(`infinitepay: cobranca nao gravou: ${error.message}`);

  return url;
}

export type VoltaInfinitepay = { pedido: string; transacao: string; slug: string };

/** Os três campos que identificam o pagamento, venham do aviso ou da volta. */
export function lerVolta(fonte: Record<string, unknown>): VoltaInfinitepay | null {
  const pedido = String(fonte.order_nsu ?? "");
  const transacao = String(fonte.transaction_nsu ?? "");
  const slug = String(fonte.slug ?? fonte.invoice_slug ?? "");
  if (!pedido.startsWith("IP") || !transacao || !slug) return null;
  return { pedido, transacao, slug };
}

export type Confirmacao =
  | { ok: true; agendamento: string }
  /** `repetir`: vale a InfinitePay mandar o aviso de novo. */
  | { ok: false; motivo: string; repetir: boolean };

/**
 * Confirma o horário de um pagamento da InfinitePay.
 *
 * Chamado pelo aviso e pela volta do cliente, o que chegar primeiro. O segundo
 * sai sem fazer nada: o `confirmar_pix` é o mesmo da Stripe e não lança o
 * caixa duas vezes.
 */
export async function confirmarPelaInfinitepay(
  volta: VoltaInfinitepay,
): Promise<Confirmacao> {
  const supabase = clienteServico();

  const { data: cobranca } = await supabase
    .from("payments")
    .select("id, appointment_id, valor_centavos, status")
    .eq("txid", volta.pedido)
    .eq("metodo", "infinitepay")
    .maybeSingle();

  if (!cobranca) return { ok: false, motivo: "cobranca_desconhecida", repetir: false };
  if (cobranca.status === "confirmado") {
    return { ok: true, agendamento: cobranca.appointment_id };
  }

  let paga = false;
  let valorPago = 0;
  try {
    const r = await fetch(`${API}/payment_check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: tag(),
        order_nsu: volta.pedido,
        transaction_nsu: volta.transacao,
        slug: volta.slug,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`payment_check respondeu ${r.status}`);
    const j = (await r.json()) as { success?: boolean; paid?: boolean; amount?: number };
    paga = j.success === true && j.paid === true;
    valorPago = Number(j.amount);
  } catch (erro) {
    // Sem conferir, nada confirma: melhor a InfinitePay avisar de novo.
    return { ok: false, motivo: (erro as Error).message, repetir: true };
  }

  // O link nasce só com a tag, sem senha: qualquer um cria outro com o mesmo
  // order_nsu e um centavo. O valor pago tem que cobrir o do horário.
  if (!paga || !(valorPago >= cobranca.valor_centavos)) {
    return { ok: false, motivo: "nao_pago", repetir: false };
  }

  const { error } = await supabase.rpc("confirmar_pix", { p_txid: volta.pedido });

  if (error) {
    /**
     * Pagou depois de a reserva vencer, e alguém marcou o mesmo horário no
     * meio-tempo: a trava de sobreposição recusa. O dinheiro entrou e a
     * cadeira não existe mais. Avisar de novo não muda isso, então fica no
     * log para o Johny devolver ou remarcar.
     */
    const ocupado = error.code === "23P01" || /sem_sobreposicao/.test(error.message);
    console.error(
      ocupado
        ? "infinitepay: PAGO, MAS O HORARIO JA ERA DE OUTRO. Devolver ou remarcar:"
        : "infinitepay: nao consegui confirmar:",
      volta.pedido,
      cobranca.appointment_id,
      error.message,
    );
    return { ok: false, motivo: error.message, repetir: !ocupado };
  }

  // Pagou aqui: o pix ou o cartão que ficou esperando para o mesmo horário
  // não espera mais, senão o Johny iria atrás de um dinheiro que já entrou.
  await supabase
    .from("payments")
    .update({ status: "expirado" })
    .eq("appointment_id", cobranca.appointment_id)
    .eq("status", "aguardando")
    .neq("id", cobranca.id);

  return { ok: true, agendamento: cobranca.appointment_id };
}
