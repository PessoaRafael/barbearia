import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cartão pela Stripe.
 *
 * Fica fora da interface `ProvedorPagamento` de propósito: aquela descreve
 * quem substitui o pix, e a Stripe não substitui. O pix do site cai direto na
 * chave do Johny, na hora e sem taxa, e continua sendo o caminho principal —
 * a Stripe entra ao lado, só para quem quer cartão, que hoje simplesmente não
 * existe.
 *
 * Usa Checkout hospedado: a página do cartão é da Stripe, não nossa. Assim
 * número de cartão nunca passa por aqui, o que tira do caminho toda a parte
 * chata de PCI para uma barbearia de três cadeiras.
 */

const BASE = "https://api.stripe.com/v1";

function chave() {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("stripe_sem_chave");
  return k;
}

/** Ligar exige a chave e o interruptor: só a credencial existir não basta. */
export function cartaoLigado() {
  return process.env.STRIPE_ATIVO === "true" && Boolean(process.env.STRIPE_SECRET_KEY);
}

async function chamar(caminho: string, corpo?: Record<string, string>) {
  const r = await fetch(`${BASE}/${caminho}`, {
    method: corpo ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${chave()}`,
      ...(corpo ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: corpo ? new URLSearchParams(corpo) : undefined,
  });

  const dados = await r.json();
  if (!r.ok) {
    throw new Error(`stripe_${r.status}: ${dados?.error?.message ?? "sem detalhe"}`);
  }
  return dados;
}


/**
 * O que a gente manda junto de toda cobrança, e por quê.
 *
 * `billing_address_collection` — a Stripe pede o endereço na página dela e
 * repassa ao antifraude e ao banco emissor. Cobrança sem endereço chega ao
 * banco como transação "magra", e banco recusa transação magra de
 * estabelecimento que nunca viu: foi o `do_not_honor` que apareceu no
 * primeiro teste.
 *
 * `statement_descriptor` — é o que sai na fatura do cliente. Sem isso ele lê
 * um nome que não reconhece, liga para o banco e contesta a compra. Contestação
 * custa taxa, devolve o dinheiro e ainda queima a reputação da conta; o nome
 * certo na fatura evita a maior parte disso.
 */
const SEMPRE: Record<string, string> = {
  billing_address_collection: "required",
  "payment_intent_data[statement_descriptor]": "JOHNY BARBEARIA",
};

export type SessaoCartao = {
  /** Vira o txid do pagamento: é por ele que o webhook acha a cobrança. */
  id: string;
  url: string;
};

/**
 * Página de pagamento para um agendamento.
 *
 * `client_reference_id` e o metadata carregam o agendamento até o webhook, e
 * é assim que a confirmação volta sozinha para a agenda — sem ninguém
 * conferir extrato.
 */
export async function sessaoDeCartao(entrada: {
  agendamentoId: string;
  valorCentavos: number;
  descricao: string;
  clienteNome: string;
  clienteEmail?: string | null;
  siteUrl: string;
  tokenCliente: string;
}): Promise<SessaoCartao> {
  const site = entrada.siteUrl.replace(/\/$/, "");
  const volta = `${site}/meu-agendamento/${entrada.tokenCliente}`;

  const corpo: Record<string, string> = {
    ...SEMPRE,
    mode: "payment",
    "payment_method_types[0]": "card",
    client_reference_id: entrada.agendamentoId,
    "metadata[agendamento]": entrada.agendamentoId,
    // A Stripe manda de volta para cá com ?pago=1 — a tela usa isso só para
    // dizer "recebemos"; quem confirma de verdade é o webhook.
    success_url: `${volta}?pago=1`,
    cancel_url: volta,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "brl",
    "line_items[0][price_data][unit_amount]": String(entrada.valorCentavos),
    "line_items[0][price_data][product_data][name]": entrada.descricao,
    "line_items[0][price_data][product_data][description]": `No nome de ${entrada.clienteNome}`,
  };

  if (entrada.clienteEmail) corpo.customer_email = entrada.clienteEmail;

  const s = await chamar("checkout/sessions", corpo);
  return { id: s.id as string, url: s.url as string };
}

/**
 * Página de pagamento da mensalidade do clube.
 *
 * Mesma peça do agendamento, com outro carimbo no metadata: é ele que diz ao
 * webhook se o que voltou é um horário para confirmar ou uma assinatura para
 * ligar. O valor vem do plano escolhido — R$ 129,99 ou R$ 189,99 — igual ao
 * corte vem do serviço.
 */
export async function sessaoDoClube(entrada: {
  barbeariaId: string;
  clienteId: string;
  planoId: string;
  planoNome: string;
  valorCentavos: number;
  clienteNome: string;
  siteUrl: string;
}): Promise<SessaoCartao> {
  const site = entrada.siteUrl.replace(/\/$/, "");

  const s = await chamar("checkout/sessions", {
    ...SEMPRE,
    mode: "payment",
    "payment_method_types[0]": "card",
    client_reference_id: entrada.clienteId,
    "metadata[tipo]": "clube",
    "metadata[barbearia]": entrada.barbeariaId,
    "metadata[cliente]": entrada.clienteId,
    "metadata[plano]": entrada.planoId,
    success_url: `${site}/?clube=ok`,
    cancel_url: `${site}/?clube=voltou`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "brl",
    "line_items[0][price_data][unit_amount]": String(entrada.valorCentavos),
    "line_items[0][price_data][product_data][name]": `Clube Johny · ${entrada.planoNome}`,
    "line_items[0][price_data][product_data][description]": `No nome de ${entrada.clienteNome}`,
  });

  return { id: s.id as string, url: s.url as string };
}


/**
 * Assinatura recorrente do clube.
 *
 * Diferente da cobrança avulsa em uma coisa que muda tudo: a Stripe guarda o
 * cartão e cobra sozinha a cada 30 dias. O Johny para de perseguir 49 pessoas
 * por mês, e o cliente para de receber cobrança no WhatsApp.
 *
 * `customer_creation` não entra aqui: em modo assinatura a Stripe cria o
 * cliente sempre, porque precisa dele para cobrar de novo.
 */
export async function sessaoDeAssinatura(entrada: {
  barbeariaId: string;
  clienteId: string;
  planoId: string;
  precoStripe: string;
  clienteNome: string;
  clienteEmail?: string | null;
  siteUrl: string;
}): Promise<SessaoCartao> {
  const site = entrada.siteUrl.replace(/\/$/, "");

  const corpo: Record<string, string> = {
    ...SEMPRE,
    mode: "subscription",
    "payment_method_types[0]": "card",
    client_reference_id: entrada.clienteId,
    "metadata[tipo]": "assinatura",
    "metadata[barbearia]": entrada.barbeariaId,
    "metadata[cliente]": entrada.clienteId,
    "metadata[plano]": entrada.planoId,
    // O mesmo carimbo vai na assinatura criada, senão o webhook de renovação
    // chegaria daqui a 30 dias sem saber de quem é.
    "subscription_data[metadata][barbearia]": entrada.barbeariaId,
    "subscription_data[metadata][cliente]": entrada.clienteId,
    "subscription_data[metadata][plano]": entrada.planoId,
    success_url: `${site}/?clube=ok`,
    cancel_url: `${site}/?clube=voltou`,
    "line_items[0][quantity]": "1",
    "line_items[0][price]": entrada.precoStripe,
  };

  if (entrada.clienteEmail) corpo.customer_email = entrada.clienteEmail;

  const s = await chamar("checkout/sessions", corpo);
  return { id: s.id as string, url: s.url as string };
}

/**
 * Cancelar no fim do período pago, nunca na hora.
 *
 * Ele pagou 30 dias; tirar o acesso no dia do clique seria ficar com dinheiro
 * dele. Até lá continua entrando normalmente, e se mudar de ideia é só voltar
 * atrás — por isso `cancel_at_period_end` e não o cancelamento imediato.
 */
export async function cancelarNoFimDoCiclo(assinaturaId: string) {
  const s = await chamar(`subscriptions/${assinaturaId}`, {
    cancel_at_period_end: "true",
  });
  return { ate: fimDoPeriodo(s) };
}

/**
 * Até quando o período pago vale.
 *
 * Nas versões novas da API isso saiu da assinatura e foi para o item — a
 * assinatura passou a poder ter itens com ciclos diferentes. Ler só do lugar
 * antigo devolvia `undefined` silenciosamente, e a data virava null sem
 * ninguém perceber.
 */
function fimDoPeriodo(s: Record<string, unknown>): Date | null {
  const item = (s.items as { data?: { current_period_end?: number }[] })
    ?.data?.[0];

  const fim =
    (s.current_period_end as number | undefined) ??
    item?.current_period_end ??
    (s.trial_end as number | undefined);

  return fim ? new Date(fim * 1000) : null;
}

/** Desistiu de cancelar: volta a renovar. */
export async function voltarAtrasNoCancelamento(assinaturaId: string) {
  await chamar(`subscriptions/${assinaturaId}`, {
    cancel_at_period_end: "false",
  });
}

/**
 * Página da Stripe onde ele troca o cartão.
 *
 * Trocar cartão tem que ser lá: número de cartão não passa pelo nosso
 * servidor, e não queremos que passe. Cancelar, ao contrário, fica na nossa
 * área — mandar alguém para fora do site para cancelar parece que ele saiu da
 * barbearia.
 */
export async function portalDoCliente(clienteStripe: string, voltarPara: string) {
  const s = await chamar("billing_portal/sessions", {
    customer: clienteStripe,
    return_url: voltarPara,
  });
  return s.url as string;
}

/** Dados da assinatura na Stripe: usado para conferir antes de agir. */
export async function verAssinatura(assinaturaId: string) {
  const s = await chamar(`subscriptions/${assinaturaId}`);
  return {
    status: s.status as string,
    cancelaNoFim: Boolean(s.cancel_at_period_end),
    ate: fimDoPeriodo(s),
  };
}

/** O que a Stripe carimbou na cobrança: serve para saber o que confirmar. */
export async function marcasDaSessao(sessaoId: string) {
  const s = await chamar(`checkout/sessions/${sessaoId}`);
  return {
    // Em assinatura o pagamento entra pela primeira fatura, e o campo vem
    // como "no_payment_required" nos casos em que a Stripe já resolveu.
    paga: s.payment_status === "paid" || s.status === "complete",
    metadata: (s.metadata ?? {}) as Record<string, string>,
    assinatura: (s.subscription ?? null) as string | null,
    clienteStripe: (s.customer ?? null) as string | null,
  };
}

/** Confere se a cobrança foi mesmo paga, perguntando para a Stripe. */
export async function sessaoFoiPaga(sessaoId: string) {
  const s = await chamar(`checkout/sessions/${sessaoId}`);
  return s.payment_status === "paid";
}

/**
 * Assinatura do webhook.
 *
 * Isto é o que a integração do PagBank não tinha: lá o aviso chegava sem
 * assinatura e a gente precisava consultar de volta para ter certeza. Aqui a
 * Stripe assina o corpo com um segredo que só nós dois conhecemos, então dá
 * para confiar no que chegou — desde que a conferência seja feita direito.
 *
 * O corpo tem que ser o texto cru recebido. Reserializar o JSON muda um
 * espaço que seja e a assinatura não bate mais.
 */
export function assinaturaConfere(corpoCru: string, cabecalho: string | null) {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo || !cabecalho) return false;

  const partes = Object.fromEntries(
    cabecalho.split(",").map((p) => p.split("=", 2) as [string, string]),
  );

  const t = partes.t;
  const recebida = partes.v1;
  if (!t || !recebida) return false;

  // Aviso velho não vale: sem isso, quem gravasse um webhook antigo poderia
  // reenviar amanhã e confirmar um pagamento que não aconteceu de novo.
  const idade = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(idade) || idade > 300) return false;

  const esperada = createHmac("sha256", segredo)
    .update(`${t}.${corpoCru}`)
    .digest("hex");

  const a = Buffer.from(esperada);
  const b = Buffer.from(recebida);
  // Comparar com === vaza, pelo tempo da comparação, quantos bytes bateram.
  return a.length === b.length && timingSafeEqual(a, b);
}
