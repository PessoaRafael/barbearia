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
