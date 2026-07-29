"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirDono, exigirSessao } from "@/lib/auth/sessao";
import { gerarChave, hashChave, prefixoDe } from "@/lib/auth/chaves";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Toda ação do painel manda o id da chave de acesso, que sai do cookie
 * httpOnly. Quem decide o que ela pode fazer é a função no Postgres — aqui só
 * repassamos. Nenhuma delas confia em id vindo do formulário.
 */

export async function decidirPix(pagamentoId: string, recebido: boolean) {
  const sessao = await exigirDono();
  const { error } = await clienteServico().rpc("decidir_pix", {
    p_chave: sessao.chaveId,
    p_pagamento: pagamentoId,
    p_recebido: recebido,
  });

  if (error) return { erro: "Não consegui registrar agora." };

  revalidatePath("/painel");
  return { ok: true };
}

export async function encerrar(
  agendamentoId: string,
  status: "concluido" | "faltou",
) {
  const sessao = await exigirSessao();
  const { error } = await clienteServico().rpc("encerrar_atendimento", {
    p_chave: sessao.chaveId,
    p_agendamento: agendamentoId,
    p_status: status,
  });

  if (error) return { erro: "Não consegui atualizar esse atendimento." };

  revalidatePath("/painel");
  revalidatePath("/agenda");
  return { ok: true };
}

const bloqueio = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inicio: z.string().regex(/^\d{2}:\d{2}$/),
  fim: z.string().regex(/^\d{2}:\d{2}$/),
  motivo: z.string().trim().max(80).optional(),
  barbeiroId: z.string().uuid().nullable().optional(),
});

export async function bloquear(entrada: z.input<typeof bloqueio>) {
  const analise = bloqueio.safeParse(entrada);
  if (!analise.success) return { erro: "Horário inválido." };

  const sessao = await exigirSessao();
  const { error } = await clienteServico().rpc("bloquear_horario", {
    p_chave: sessao.chaveId,
    p_data: analise.data.data,
    p_inicio: analise.data.inicio,
    p_fim: analise.data.fim,
    p_motivo: analise.data.motivo ?? null,
    p_barbeiro: analise.data.barbeiroId ?? null,
  });

  if (error) return { erro: "Não consegui bloquear esse horário." };

  revalidatePath("/painel");
  revalidatePath("/agenda");
  return { ok: true };
}

export async function liberarBloqueio(bloqueioId: string) {
  const sessao = await exigirSessao();
  const supabase = clienteServico();

  // O barbeiro só solta bloqueio da própria agenda.
  const { data: alvo } = await supabase
    .from("breaks")
    .select("id, barber_id, data")
    .eq("id", bloqueioId)
    .maybeSingle();

  if (!alvo || !alvo.data) return { erro: "Bloqueio não encontrado." };
  if (sessao.papel === "barber" && alvo.barber_id !== sessao.barbeiroId) {
    return { erro: "Esse bloqueio não é da sua agenda." };
  }

  await supabase.from("breaks").delete().eq("id", bloqueioId);

  revalidatePath("/painel");
  revalidatePath("/agenda");
  return { ok: true };
}

/**
 * Gera a chave de um barbeiro. O texto puro existe só neste retorno: no banco
 * fica o hash, e a tela avisa que não mostra de novo.
 */
export async function gerarChaveDe(barbeiroId: string) {
  const sessao = await exigirDono();
  const chave = gerarChave();

  const { error } = await clienteServico().rpc("criar_chave", {
    p_chave: sessao.chaveId,
    p_barbeiro: barbeiroId,
    p_hash: hashChave(chave),
    p_prefixo: prefixoDe(chave),
  });

  if (error) return { erro: "Não consegui gerar a chave." };

  revalidatePath("/painel");
  return { ok: true, chave };
}

export async function revogarChaveDe(chaveId: string) {
  const sessao = await exigirDono();
  const { error } = await clienteServico().rpc("revogar_chave", {
    p_chave: sessao.chaveId,
    p_alvo: chaveId,
  });

  if (error) return { erro: "Não consegui revogar." };

  revalidatePath("/painel");
  return { ok: true };
}

const configuracoes = z.object({
  pixKey: z.string().trim().min(5).max(80),
  pixTitular: z.string().trim().min(3).max(60),
  modalidade: z.enum(["opcional", "obrigatorio"]),
  reservaMinutos: z.coerce.number().int().min(5).max(120),
  clubePreco: z.coerce.number().int().min(0).max(100000),
  clubeCortes: z.coerce.number().int().min(1).max(30),
});

export async function salvarConfiguracoes(
  _estado: { erro?: string; ok?: boolean } | null,
  formulario: FormData,
) {
  const sessao = await exigirDono();

  const analise = configuracoes.safeParse({
    pixKey: formulario.get("pixKey"),
    pixTitular: formulario.get("pixTitular"),
    modalidade: formulario.get("modalidade"),
    reservaMinutos: formulario.get("reservaMinutos"),
    clubePreco: formulario.get("clubePreco"),
    clubeCortes: formulario.get("clubeCortes"),
  });

  if (!analise.success) return { erro: "Confira os campos." };

  const { error } = await clienteServico()
    .from("barbershops")
    .update({
      pix_key: analise.data.pixKey.replace(/\s/g, ""),
      pix_titular: analise.data.pixTitular,
      pagamento_modalidade: analise.data.modalidade,
      reserva_minutos: analise.data.reservaMinutos,
      clube_preco_centavos: analise.data.clubePreco * 100,
      clube_cortes_mes: analise.data.clubeCortes,
    })
    .eq("id", sessao.barbeariaId);

  if (error) return { erro: "Não consegui salvar." };

  revalidatePath("/painel");
  revalidatePath("/agendar");
  return { ok: true };
}
