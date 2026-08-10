"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import {
  chaveValida,
  conferirChave,
  normalizarChave,
  prefixoDe,
} from "@/lib/auth/chaves";
import { criarSessao, encerrarSessao } from "@/lib/auth/sessao";
import { clienteServico } from "@/lib/supabase/servidor";

const TENTATIVAS = 5;
const JANELA_MIN = 15;

/**
 * O erro é sempre o mesmo, dê o que der: chave curta, inexistente, revogada ou
 * vencida. Mensagem diferente por caso conta para quem está tentando adivinhar
 * qual parte ele acertou.
 */
const ERRO = "Chave inválida ou revogada.";

const entrada = z.object({ chave: z.string().min(1).max(40) });

async function ipDaRequisicao() {
  const cabecalhos = await headers();
  const encaminhado = cabecalhos.get("x-forwarded-for");
  return encaminhado?.split(",")[0]?.trim() ?? "desconhecido";
}

async function passouDoLimite(ip: string) {
  const supabase = clienteServico();
  const desde = new Date(Date.now() - JANELA_MIN * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("sucesso", false)
    .gte("criado_em", desde);

  return (count ?? 0) >= TENTATIVAS;
}

async function registrar(ip: string, prefixo: string | null, sucesso: boolean) {
  const supabase = clienteServico();
  await supabase
    .from("login_attempts")
    .insert({ ip, key_prefix: prefixo, sucesso });
}

export async function entrar(
  _estado: { erro?: string } | null,
  formulario: FormData,
): Promise<{ erro?: string }> {
  const analise = entrada.safeParse({ chave: formulario.get("chave") });
  if (!analise.success) return { erro: ERRO };

  const ip = await ipDaRequisicao();
  const chave = normalizarChave(analise.data.chave);

  if (!chaveValida(chave)) {
    await registrar(ip, null, false);
    return { erro: ERRO };
  }

  const supabase = clienteServico();
  const prefixo = prefixoDe(chave);

  /**
   * As duas leituras vão juntas: conferir o limite de tentativas não depende
   * de achar a chave. Em fila, cada uma custava uma volta de rede inteira, e
   * era metade da espera do Johny na tela de entrar.
   */
  const [passou, { data: candidatas }] = await Promise.all([
    passouDoLimite(ip),
    // O prefixo estreita a busca; quem decide é o hash.
    supabase
      .from("access_keys")
      .select("id, key_hash, role, barbershop_id, expira_em, revogada_em")
      .eq("key_prefix", prefixo)
      .is("revogada_em", null),
  ]);

  if (passou) {
    return {
      erro: `Muita tentativa seguida. Espere ${JANELA_MIN} minutos e tente de novo.`,
    };
  }

  const encontrada = (candidatas ?? []).find((linha) =>
    conferirChave(chave, linha.key_hash),
  );

  if (!encontrada) {
    await registrar(ip, prefixo, false);
    return { erro: ERRO };
  }

  if (encontrada.expira_em && new Date(encontrada.expira_em) < new Date()) {
    await registrar(ip, prefixo, false);
    return { erro: ERRO };
  }

  await criarSessao(
    encontrada.id,
    encontrada.role,
    encontrada.barbershop_id as string,
  );

  /**
   * Carimbo e registro de acerto saem do caminho: o Johny não precisa esperar
   * duas escritas para a tela abrir. Só o registro de erro fica bloqueando, e
   * de propósito, porque é ele que segura quem fica tentando adivinhar.
   */
  after(async () => {
    await Promise.all([
      supabase
        .from("access_keys")
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq("id", encontrada.id),
      registrar(ip, prefixo, true),
    ]);
  });

  // O destino sai do papel guardado na chave, nunca de parâmetro da URL.
  redirect(
    encontrada.role === "owner"
      ? "/painel"
      : encontrada.role === "client"
        ? "/clube"
        : "/agenda",
  );
}

export async function sair() {
  await encerrarSessao();
  redirect("/entrar");
}
