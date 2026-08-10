import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { clienteServico } from "@/lib/supabase/servidor";

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

function selar(chaveId: string) {
  const corpo = Buffer.from(JSON.stringify({ k: chaveId })).toString(
    "base64url",
  );
  return `${corpo}.${assinar(corpo)}`;
}

function abrir(cookie: string): string | null {
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
    return JSON.parse(Buffer.from(corpo, "base64url").toString()).k ?? null;
  } catch {
    return null;
  }
}

export async function criarSessao(chaveId: string, papel: Papel) {
  const jar = await cookies();
  const opcoes = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS * 24 * 60 * 60,
  };

  jar.set(COOKIE, selar(chaveId), opcoes);
  jar.set(COOKIE_PAPEL, papel, opcoes);
}

export async function encerrarSessao() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(COOKIE_PAPEL);
}

/** Último acesso, no máximo uma escrita por hora por chave. */
async function carimbar(chaveId: string) {
  const supabase = clienteServico();
  const { data: visto } = await supabase
    .from("access_keys")
    .select("ultimo_acesso")
    .eq("id", chaveId)
    .maybeSingle();

  const quando = visto?.ultimo_acesso
    ? new Date(visto.ultimo_acesso).getTime()
    : 0;

  if (Date.now() - quando > 60 * 60 * 1000) {
    await supabase
      .from("access_keys")
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq("id", chaveId);
  }
}

/** Null quando não há cookie, a assinatura não bate ou a chave foi revogada. */
export async function lerSessao(): Promise<Sessao | null> {
  const jar = await cookies();
  const cookie = jar.get(COOKIE)?.value;
  if (!cookie) return null;

  const chaveId = abrir(cookie);
  if (!chaveId) return null;

  const supabase = clienteServico();

  /**
   * O assinante do clube é resolvido lendo a linha direto, porque a função
   * sessao_atual devolve o tipo app.sessao, que só conhece dono e barbeiro.
   * Trocar aquele tipo cascatearia em todas as funções do painel, e não vale
   * o risco por um campo.
   */
  const { data: linha } = await supabase
    .from("access_keys")
    .select("id, role, barbershop_id, client_id, revogada_em, expira_em")
    .eq("id", chaveId)
    .maybeSingle();

  if (!linha || linha.revogada_em) return null;
  if (linha.expira_em && new Date(linha.expira_em) < new Date()) return null;

  if (linha.role === "client") {
    const { data: cliente } = await supabase
      .from("clients")
      .select("nome")
      .eq("id", linha.client_id)
      .maybeSingle();

    await carimbar(chaveId);

    return {
      chaveId: linha.id,
      papel: "client",
      barbeariaId: linha.barbershop_id,
      barbeiroId: null,
      clienteId: linha.client_id,
      nome: cliente?.nome ?? "Cliente",
    };
  }

  /**
   * Dono e barbeiro passam pela função: access_keys tem duas chaves
   * estrangeiras para barbers (barber_id e criada_por), e o join automático
   * do PostgREST fica ambíguo e falha.
   */
  const { data, error } = await supabase.rpc("sessao_atual", {
    p_chave: chaveId,
  });

  if (error || !data) return null;

  const sessao = data as {
    chave_id: string;
    papel: "owner" | "barber";
    barbearia_id: string;
    barbeiro_id: string | null;
    nome: string;
  };

  await carimbar(chaveId);

  return {
    chaveId: sessao.chave_id,
    papel: sessao.papel,
    barbeariaId: sessao.barbearia_id,
    barbeiroId: sessao.barbeiro_id,
    clienteId: null,
    nome: sessao.nome,
  };
}

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
