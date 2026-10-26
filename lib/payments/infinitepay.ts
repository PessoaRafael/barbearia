import "server-only";

import { randomBytes } from "node:crypto";

import { ativarAssinatura } from "@/lib/clube/ativar";
import { moedaCentavos } from "@/lib/formato";
import { enfileirar } from "@/lib/notify/whatsapp";
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
 *
 * Duas coisas cobram por aqui, e o começo do pedido diz qual é:
 *
 *   IP  um horário, com a linha em `payments`
 *   IC  a mensalidade do clube, com a linha em `cobrancas_do_clube`
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

function endereco() {
  const site = process.env.SITE_URL?.replace(/\/$/, "");
  if (!site) throw new Error("infinitepay: sem SITE_URL");
  return site;
}

async function criarLink(entrada: {
  pedido: string;
  valorCentavos: number;
  /** "Corte + Barba": é o que o cliente lê na página de pagamento. */
  descricao: string;
  /** Para onde o cliente volta, e onde a volta confere o pagamento. */
  volta: string;
  clienteNome: string;
  clienteEmail?: string | null;
}) {
  const r = await fetch(`${API}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: tag(),
      items: [
        { quantity: 1, price: entrada.valorCentavos, description: entrada.descricao },
      ],
      order_nsu: entrada.pedido,
      redirect_url: entrada.volta,
      webhook_url: `${endereco()}/api/webhook/infinitepay`,
      ...(entrada.clienteEmail
        ? { customer: { name: entrada.clienteNome, email: entrada.clienteEmail } }
        : {}),
    }),
    // Quem chama tem o pix de sempre por baixo: travar aqui seguraria o
    // cliente olhando a tela em vez de cair nele.
    signal: AbortSignal.timeout(10_000),
  });

  const dados = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  const url = dados.url ?? dados.link ?? dados.checkout_url;
  if (!r.ok || typeof url !== "string") {
    throw new Error(`infinitepay_${r.status}: ${JSON.stringify(dados).slice(0, 200)}`);
  }
  return url;
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
  descricao: string;
  clienteNome: string;
  clienteEmail?: string | null;
  /** O prazo da reserva. A linha morre junto com ela. */
  expiraEm: Date | string | null;
}): Promise<string> {
  const pedido = `IP${entrada.agendamentoId.replace(/-/g, "")}${randomBytes(3).toString("hex")}`;

  const url = await criarLink({
    pedido,
    valorCentavos: entrada.valorCentavos,
    descricao: entrada.descricao,
    // A volta cai no link do cliente, que confere e confirma por conta
    // própria se o aviso ainda não tiver chegado.
    volta: `${endereco()}/meu-agendamento/${entrada.tokenCliente}`,
    clienteNome: entrada.clienteNome,
    clienteEmail: entrada.clienteEmail,
  });

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

/**
 * Link de pagamento da mensalidade, já com a linha em `cobrancas_do_clube`.
 *
 * Serve para entrar no clube e para renovar: quem decide o que acontece é
 * `ativarAssinatura`, quando o pagamento passa.
 */
export async function cobrarMensalidadeNaInfinitepay(entrada: {
  barbeariaId: string;
  clienteId: string;
  planoId: string;
  valorCentavos: number;
  descricao: string;
  clienteNome: string;
  /** A página da mensalidade do cliente, que confere na volta. */
  volta: string;
}): Promise<string> {
  const pedido = `IC${entrada.clienteId.replace(/-/g, "")}${randomBytes(3).toString("hex")}`;

  const url = await criarLink({
    pedido,
    valorCentavos: entrada.valorCentavos,
    descricao: entrada.descricao,
    volta: entrada.volta,
    clienteNome: entrada.clienteNome,
  });

  const { error } = await clienteServico().from("cobrancas_do_clube").insert({
    barbershop_id: entrada.barbeariaId,
    client_id: entrada.clienteId,
    plan_id: entrada.planoId,
    valor_centavos: entrada.valorCentavos,
    pedido,
  });
  if (error) throw new Error(`infinitepay: mensalidade nao gravou: ${error.message}`);

  return url;
}

export type VoltaInfinitepay = { pedido: string; transacao: string; slug: string };

/** Os três campos que identificam o pagamento, venham do aviso ou da volta. */
export function lerVolta(fonte: Record<string, unknown>): VoltaInfinitepay | null {
  const pedido = String(fonte.order_nsu ?? "");
  const transacao = String(fonte.transaction_nsu ?? "");
  const slug = String(fonte.slug ?? fonte.invoice_slug ?? "");
  if (!/^I[PC]/.test(pedido) || !transacao || !slug) return null;
  return { pedido, transacao, slug };
}

export type Confirmacao =
  | { ok: true }
  /** `repetir`: vale a InfinitePay mandar o aviso de novo. */
  | { ok: false; motivo: string; repetir: boolean };

/**
 * Pergunta à InfinitePay se o pagamento existe e quanto entrou. Lança quando
 * não deu para perguntar: aí ninguém confirma nada no escuro.
 */
async function conferir(volta: VoltaInfinitepay) {
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
  return { paga: j.success === true && j.paid === true, valor: Number(j.amount) };
}

/**
 * Confirma o que a InfinitePay disse que foi pago: o horário ou a
 * mensalidade, pelo começo do pedido.
 *
 * Chamado pelo aviso e pela volta do cliente, o que chegar primeiro. O segundo
 * sai sem fazer nada.
 */
export async function confirmarPelaInfinitepay(
  volta: VoltaInfinitepay,
): Promise<Confirmacao> {
  return volta.pedido.startsWith("IC")
    ? confirmarMensalidade(volta)
    : confirmarHorario(volta);
}

async function confirmarHorario(volta: VoltaInfinitepay): Promise<Confirmacao> {
  const supabase = clienteServico();

  const { data: cobranca } = await supabase
    .from("payments")
    .select("id, appointment_id, valor_centavos, status")
    .eq("txid", volta.pedido)
    .eq("metodo", "infinitepay")
    .maybeSingle();

  if (!cobranca) return { ok: false, motivo: "cobranca_desconhecida", repetir: false };
  if (cobranca.status === "confirmado") return { ok: true };
  if (cobranca.status === "pago_sem_horario") {
    return { ok: false, motivo: "pago_sem_horario", repetir: false };
  }

  let pagamento;
  try {
    pagamento = await conferir(volta);
  } catch (erro) {
    // Sem conferir, nada confirma: melhor a InfinitePay avisar de novo.
    return { ok: false, motivo: (erro as Error).message, repetir: true };
  }

  // O link nasce só com a tag, sem senha: qualquer um cria outro com o mesmo
  // order_nsu e um centavo. O valor pago tem que cobrir o do horário.
  if (!pagamento.paga || !(pagamento.valor >= cobranca.valor_centavos)) {
    return { ok: false, motivo: "nao_pago", repetir: false };
  }

  // O `confirmar_pix` é o mesmo da Stripe e não lança o caixa duas vezes.
  // Pago depois do prazo com a cadeira ainda livre, ele devolve o horário.
  const { error } = await supabase.rpc("confirmar_pix", { p_txid: volta.pedido });

  if (error) {
    const ocupado = error.code === "23P01" || /sem_sobreposicao/.test(error.message);
    if (ocupado) {
      await pagoSemHorario(cobranca.id, cobranca.appointment_id, cobranca.valor_centavos);
      return { ok: false, motivo: "pago_sem_horario", repetir: false };
    }
    console.error("infinitepay: nao consegui confirmar:", volta.pedido, error.message);
    return { ok: false, motivo: error.message, repetir: true };
  }

  // Pagou aqui: o pix ou o cartão que ficou esperando para o mesmo horário
  // não espera mais, senão o Johny iria atrás de um dinheiro que já entrou.
  await supabase
    .from("payments")
    .update({ status: "expirado" })
    .eq("appointment_id", cobranca.appointment_id)
    .eq("status", "aguardando")
    .neq("id", cobranca.id);

  return { ok: true };
}

/**
 * Pagou depois de a reserva vencer, e outro cliente já tinha pegado a cadeira.
 *
 * A trava de sobreposição recusou, e a API de link da InfinitePay não tem
 * estorno. Antes isso ficava só no log da Vercel, e a tela do cliente dizia
 * que o pix não tinha caído com o dinheiro dele na conta.
 *
 * Agora a cobrança fica marcada, a tela dele conta a verdade, e a mensagem
 * para remarcar ou devolver já entra pronta na fila do Johny. Aviso e volta
 * chegando juntos: só quem marcar primeiro põe a mensagem na fila.
 */
async function pagoSemHorario(pagamentoId: string, agendamentoId: string, valor: number) {
  const supabase = clienteServico();

  const { data: marcou } = await supabase
    .from("payments")
    .update({ status: "pago_sem_horario", confirmado_em: new Date().toISOString() })
    .eq("id", pagamentoId)
    .in("status", ["aguardando", "expirado"])
    .select("id");
  if (!marcou?.length) return;

  console.error("infinitepay: PAGO, MAS O HORARIO JA ERA DE OUTRO:", agendamentoId);

  const { data: ag } = await supabase
    .from("appointments")
    .select("barbershop_id, inicio, clients(nome, telefone)")
    .eq("id", agendamentoId)
    .maybeSingle();

  const cliente = (Array.isArray(ag?.clients) ? ag?.clients[0] : ag?.clients) as
    | { nome: string; telefone: string }
    | null
    | undefined;
  if (!ag || !cliente) return;

  const inicio = new Date(ag.inicio as string);
  const dia = inicio.toLocaleDateString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
  });
  const hora = inicio.toLocaleTimeString("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
  });

  await enfileirar({
    barbeariaId: ag.barbershop_id as string,
    destino: "cliente",
    template: "pago_sem_horario",
    telefone: cliente.telefone,
    dados: {
      cliente: cliente.nome.split(" ")[0],
      quando: `${dia} às ${hora}`,
      valor: moedaCentavos(valor),
    },
  }).catch(() => {});
}

async function confirmarMensalidade(volta: VoltaInfinitepay): Promise<Confirmacao> {
  const supabase = clienteServico();

  const { data: cobranca } = await supabase
    .from("cobrancas_do_clube")
    .select("id, barbershop_id, client_id, plan_id, valor_centavos, status")
    .eq("pedido", volta.pedido)
    .maybeSingle();

  if (!cobranca) return { ok: false, motivo: "cobranca_desconhecida", repetir: false };
  if (cobranca.status === "paga") return { ok: true };

  let pagamento;
  try {
    pagamento = await conferir(volta);
  } catch (erro) {
    return { ok: false, motivo: (erro as Error).message, repetir: true };
  }

  if (!pagamento.paga || !(pagamento.valor >= cobranca.valor_centavos)) {
    return { ok: false, motivo: "nao_pago", repetir: false };
  }

  /**
   * A trava contra o aviso repetido.
   *
   * Só um consegue passar a linha de 'aguardando' para 'paga'. Aviso e volta
   * chegando no mesmo segundo: o segundo não acha mais nada para mudar e sai,
   * em vez de empurrar o ciclo mais um mês.
   */
  const { data: peguei } = await supabase
    .from("cobrancas_do_clube")
    .update({ status: "paga", paga_em: new Date().toISOString() })
    .eq("id", cobranca.id)
    .eq("status", "aguardando")
    .select("id");
  if (!peguei?.length) return { ok: true };

  const r = await ativarAssinatura({
    barbeariaId: cobranca.barbershop_id,
    clienteId: cobranca.client_id,
    planoId: cobranca.plan_id,
    somarAoQueFalta: true,
  });

  if (!r.ok) {
    // Devolve a trava: o próximo aviso tenta de novo, em vez de o dinheiro
    // ficar marcado como usado sem ter ligado nada.
    await supabase
      .from("cobrancas_do_clube")
      .update({ status: "aguardando", paga_em: null })
      .eq("id", cobranca.id);
    console.error("infinitepay: mensalidade paga, assinatura nao ligou:", volta.pedido, r.erro);
    return { ok: false, motivo: r.erro, repetir: true };
  }

  await supabase.from("cobrancas_do_clube").update({ ate: r.ate }).eq("id", cobranca.id);
  return { ok: true };
}
