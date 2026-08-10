import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { after } from "next/server";

import { clienteServico } from "@/lib/supabase/servidor";
import type { Casa } from "@/lib/dados/casa";

/**
 * Sessão de 30 dias em cookie httpOnly.
 *
 * O cookie guarda só o id da chave, assinado. Quem manda é o banco: toda
 * requisição relê a linha em access_keys, então revogar derruba a sessão no
 * próximo clique, sem esperar o cookie expirar.
 */

const COOKIE = "johny_sessao";
/** Só dica de rota para o middleware, que não fala com o banco. A permissão
 *  de verdade sai de `lerSessao` e do RLS, este cookie não autoriza nada. */
const COOKIE_PAPEL = "johny_papel";
const DIAS = 30;

export type Papel = "owner" | "barber" | "client";

export type Sessao = {
  chaveId: string;
  papel: Papel;
  barbeariaId: string;
  /** A barbearia vem junto: toda tela interna precisa dela, e assim não custa
   *  outra volta de rede só para descobrir o nome e a chave pix. */
  casa: Casa;
  barbeiroId: string | null;
  clienteId: string | null;
  nome: string;
};

function segredo() {
  const valor = process.env.SESSION_SECRET;
  if (!valor) throw new Error("SESSION_SECRET não configurado.");
  return valor;
}

function assinar(valor: string) {
  return createHmac("sha256", segredo()).update(valor).digest("base64url");
}

function selar(chaveId: string, barbeariaId: string) {
  const corpo = Buffer.from(
    JSON.stringify({ k: chaveId, b: barbeariaId }),
  ).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

function abrir(cookie: string): Cracha | null {
  const [corpo, assinatura] = cookie.split(".");
  if (!corpo || !assinatura) return null;

  const esperada = Buffer.from(assinar(corpo));
  const recebida = Buffer.from(assinatura);
  if (
    recebida.length !== esperada.length ||
    !timingSafeEqual(recebida, esperada)
  ) {
    return null;
  }

  try {
    const dentro = JSON.parse(Buffer.from(corpo, "base64url").toString());
    if (!dentro.k) return null;
    return { chaveId: dentro.k, barbeariaId: dentro.b ?? null };
  } catch {
    return null;
  }
}

/**
 * O que dá para saber sem falar com o banco, porque está assinado no cookie.
 *
 * Serve para disparar a consulta da tela em paralelo com a conferência da
 * sessão, em vez de uma esperar a outra. Não autoriza nada: se a chave tiver
 * sido revogada, `lerSessao` devolve null e a tela redireciona antes de
 * desenhar qualquer coisa, então o resultado da consulta é jogado fora.
 */
export type Cracha = { chaveId: string; barbeariaId: string | null };

export async function crachaDoCookie(): Promise<Cracha | null> {
  const jar = await cookies();
  const cookie = jar.get(COOKIE)?.value;
  return cookie ? abrir(cookie) : null;
}

export async function criarSessao(
  chaveId: string,
  papel: Papel,
  barbeariaId: string,
) {
  const jar = await cookies();
  const opcoes = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS * 24 * 60 * 60,
  };

  jar.set(COOKIE, selar(chaveId, barbeariaId), opcoes);
  jar.set(COOKIE_PAPEL, papel, opcoes);
}

export async function encerrarSessao() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(COOKIE_PAPEL);
}

/**
 * Null quando não há cookie, a assinatura não bate ou a chave foi revogada.
 *
 * Uma consulta só, e é de propósito: isto roda em toda requisição de tela
 * interna, e cada ida ao Supabase custa uma volta de rede inteira. O join com
 * barbers precisa da dica `!barber_id` porque access_keys aponta duas vezes
 * para lá (o dono da chave e quem a criou), e sem a dica o PostgREST recusa
 * por ambiguidade.
 */
export const lerSessao = cache(async (): Promise<Sessao | null> => {
  const cracha = await crachaDoCookie();
  if (!cracha) return null;

  const chaveId = cracha.chaveId;
  const supabase = clienteServico();

  const { data: linha } = await supabase
    .from("access_keys")
    .select(
      "id, role, barbershop_id, barber_id, client_id, revogada_em, expira_em, ultimo_acesso, barbershops(*), barbers!barber_id(apelido), clients(nome)",
    )
    .eq("id", chaveId)
    .maybeSingle();

  if (!linha || linha.revogada_em) return null;
  if (linha.expira_em && new Date(linha.expira_em) < new Date()) return null;

  const um = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  const barbeiro = um(linha.barbers as never) as { apelido: string } | null;
  const cliente = um(linha.clients as never) as { nome: string } | null;
  const barbearia = um(linha.barbershops as never) as Casa | null;
  if (!barbearia) return null;

  /**
   * O carimbo de último acesso não segura a resposta. É informação para o
   * Johny saber se a chave foi usada, não vale meia volta de rede em cada
   * clique dele.
   */
  const visto = linha.ultimo_acesso
    ? new Date(linha.ultimo_acesso).getTime()
    : 0;

  if (Date.now() - visto > 60 * 60 * 1000) {
    after(async () => {
      await supabase
        .from("access_keys")
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq("id", chaveId);
    });
  }

  const papel = linha.role as Papel;

  return {
    chaveId: linha.id,
    papel,
    barbeariaId: linha.barbershop_id,
    casa: barbearia,
    barbeiroId: papel === "barber" ? linha.barber_id : null,
    clienteId: papel === "client" ? linha.client_id : null,
    nome:
      papel === "client"
        ? (cliente?.nome ?? "Cliente")
        : (barbeiro?.apelido ?? "Johny"),
  };
});

/** Para rotas que já foram filtradas pelo middleware, mas precisam do dado. */
export async function exigirSessao(papel?: Papel) {
  const sessao = await lerSessao();
  if (!sessao) throw new Error("Sessão expirada.");
  if (papel && sessao.papel !== papel) throw new Error("Acesso negado.");
  return sessao;
}

export async function exigirDono() {
  return exigirSessao("owner");
}

/** Dono ou barbeiro. O assinante do clube não mexe em agenda de ninguém. */
export async function exigirEquipe() {
  const sessao = await lerSessao();
  if (!sessao) throw new Error("Sessão expirada.");
  if (sessao.papel === "client") throw new Error("Acesso negado.");
  return sessao;
}
