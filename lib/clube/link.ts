import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * O link da mensalidade de cada assinante, para ir na mensagem de cobrança.
 *
 * Nenhum assinante usa chave de acesso: a cobrança sempre foi uma mensagem no
 * WhatsApp com a chave pix. O link tem que abrir direto, sem login, e não pode
 * ser o id do cliente puro, senão trocar um caractere abriria o nome e o plano
 * de outra pessoa. Por isso vai assinado com o segredo do cookie de sessão.
 *
 * Sem coluna nova: o link sai da conta, e é o mesmo todo mês.
 */
function assinar(clienteId: string) {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo) throw new Error("SESSION_SECRET não configurado.");
  return createHmac("sha256", segredo)
    .update(`mensalidade:${clienteId}`)
    .digest("hex")
    .slice(0, 16);
}

export function tokenDaMensalidade(clienteId: string) {
  return `${clienteId.replace(/-/g, "")}${assinar(clienteId)}`;
}

/** O id do cliente, se o link for nosso. Qualquer outra coisa volta null. */
export function clienteDoToken(token: string): string | null {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;

  const h = token.slice(0, 32);
  const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

  const esperada = Buffer.from(assinar(id));
  const recebida = Buffer.from(token.slice(32));
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida)
    ? id
    : null;
}

export function linkDaMensalidade(clienteId: string) {
  const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
  return `${site}/mensalidade/${tokenDaMensalidade(clienteId)}`;
}
