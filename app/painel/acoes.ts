"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirDono, exigirEquipe } from "@/lib/auth/sessao";
import { gerarChave, hashChave, prefixoDe } from "@/lib/auth/chaves";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Toda ação do painel manda o id da chave de acesso, que sai do cookie
 * httpOnly. Quem decide o que ela pode fazer é a função no Postgres, aqui só
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
  const sessao = await exigirEquipe();
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

/**
 * Fecha um pedaço do dia. Sem barbeiro escolhido, o dono fecha a casa inteira:
 * é o caso do Johny olhar a tarde lotada e não querer mais ninguém entrando.
 *
 * Fechar não desmarca quem já está na régua, só impede horário novo. Quem já
 * pagou continua com a cadeira dele.
 */
export async function bloquear(entrada: z.input<typeof bloqueio>) {
  const analise = bloqueio.safeParse(entrada);
  if (!analise.success) return { erro: "Horário inválido." };
  if (analise.data.fim <= analise.data.inicio) {
    return { erro: "A hora de fim tem que ser depois da de início." };
  }

  const sessao = await exigirEquipe();
  const supabase = clienteServico();

  /**
   * O barbeiro nunca escolhe: a função no Postgres ignora o que vier aqui e
   * usa a agenda dele. Só o dono chega a decidir entre um e todos.
   */
  let alvos: (string | null)[] = [analise.data.barbeiroId ?? null];

  if (sessao.papel === "owner" && !analise.data.barbeiroId) {
    const { data: equipe } = await supabase
      .from("barbers")
      .select("id")
      .eq("barbershop_id", sessao.barbeariaId)
      .eq("ativo", true);

    if (!equipe?.length) return { erro: "Nenhum barbeiro ativo para fechar." };
    alvos = equipe.map((b) => b.id);
  }

  const erros = await Promise.all(
    alvos.map(async (alvo) => {
      const { error } = await supabase.rpc("bloquear_horario", {
        p_chave: sessao.chaveId,
        p_data: analise.data.data,
        p_inicio: analise.data.inicio,
        p_fim: analise.data.fim,
        p_motivo: analise.data.motivo ?? null,
        p_barbeiro: alvo,
      });
      return error;
    }),
  );

  revalidatePath("/painel");
  revalidatePath("/agenda");

  const falharam = erros.filter(Boolean).length;
  if (falharam === alvos.length) {
    return { erro: "Não consegui fechar esse horário." };
  }
  if (falharam) {
    // Melhor dizer que ficou pela metade do que deixar o Johny achar que a
    // casa está fechada quando um barbeiro ainda aceita horário.
    return { erro: `Fechei em ${alvos.length - falharam} de ${alvos.length}. Tente de novo.` };
  }

  return { ok: true };
}

/**
 * Reabre horário fechado. Aceita vários ids porque fechar a casa toda cria um
 * bloqueio por barbeiro, e reabrir tem que ser um clique só.
 */
export async function liberarBloqueio(ids: string | string[]) {
  const sessao = await exigirEquipe();
  const supabase = clienteServico();
  const lista = Array.isArray(ids) ? ids : [ids];
  if (!lista.length) return { erro: "Bloqueio não encontrado." };

  const { data: alvos } = await supabase
    .from("breaks")
    .select("id, data, barbers!inner(id, barbershop_id)")
    .in("id", lista);

  if (!alvos?.length) return { erro: "Bloqueio não encontrado." };

  const permitidos = alvos.filter((alvo) => {
    // Almoço fixo não tem data e não se solta por aqui.
    if (!alvo.data) return false;

    const b = Array.isArray(alvo.barbers) ? alvo.barbers[0] : alvo.barbers;
    const dono = b as { id: string; barbershop_id: string } | null;
    if (!dono || dono.barbershop_id !== sessao.barbeariaId) return false;

    // O barbeiro só solta bloqueio da própria agenda.
    return sessao.papel !== "barber" || dono.id === sessao.barbeiroId;
  });

  if (!permitidos.length) return { erro: "Esse bloqueio não é da sua agenda." };

  await supabase
    .from("breaks")
    .delete()
    .in(
      "id",
      permitidos.map((a) => a.id),
    );

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

/**
 * Gera a chave de acesso de um assinante. Mesmo desenho da chave do barbeiro:
 * o texto puro existe só neste retorno, no banco fica o hash.
 */
export async function gerarChaveCliente(clienteId: string) {
  const sessao = await exigirDono();
  const chave = gerarChave();

  const { error } = await clienteServico().rpc("criar_chave_cliente", {
    p_chave: sessao.chaveId,
    p_cliente: clienteId,
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

const assinante = z.object({
  nome: z.string().trim().min(2).max(80),
  telefone: z.string().trim().min(10).max(20),
  planoId: z.string().uuid(),
});

/**
 * Coloca alguém no clube. O telefone é a chave: se o cliente já existe (marcou
 * alguma vez), a assinatura cola nele e o saldo aparece no agendamento na hora.
 */
export async function inscreverNoClube(entrada: z.input<typeof assinante>) {
  const analise = assinante.safeParse(entrada);
  if (!analise.success) return { erro: "Confira nome e WhatsApp." };

  const sessao = await exigirDono();
  const telefone = analise.data.telefone.replace(/\D/g, "");
  const supabase = clienteServico();

  // Preço e duração saem do plano, não do que a tela mandou.
  const { data: plano } = await supabase
    .from("club_plans")
    .select("id, preco_centavos, duracao_dias")
    .eq("id", analise.data.planoId)
    .eq("barbershop_id", sessao.barbeariaId)
    .eq("ativo", true)
    .maybeSingle();

  const { data: cliente } = await supabase
    .from("clients")
    .upsert(
      {
        barbershop_id: sessao.barbeariaId,
        nome: analise.data.nome,
        telefone,
      },
      { onConflict: "barbershop_id,telefone" },
    )
    .select("id")
    .single();

  if (!cliente || !plano) return { erro: "Não consegui cadastrar." };

  const { data: existente } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("client_id", cliente.id)
    .neq("status", "cancelada")
    .maybeSingle();

  // O ciclo é contado em dias, não em "mês": o Johny vendeu 30 dias, e mês
  // civil daria 28 em fevereiro e 31 em março pelo mesmo dinheiro.
  const hoje = new Date();
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + plano.duracao_dias);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  // Já era assinante: isso aqui é a renovação, e ela também troca o plano se
  // o Johny escolheu outro.
  if (existente) {
    await supabase
      .from("subscriptions")
      .update({
        status: "ativa",
        plan_id: plano.id,
        preco_centavos: plano.preco_centavos,
        ciclo_inicio: iso(hoje),
        ciclo_fim: iso(fim),
        proxima_cobranca: iso(fim),
      })
      .eq("id", existente.id);

    revalidatePath("/painel");
    return { ok: true, renovou: true };
  }

  const { error } = await supabase.from("subscriptions").insert({
    barbershop_id: sessao.barbeariaId,
    client_id: cliente.id,
    status: "ativa",
    plan_id: plano.id,
    preco_centavos: plano.preco_centavos,
    cortes_mes: 0,
    ciclo_inicio: iso(hoje),
    ciclo_fim: iso(fim),
    proxima_cobranca: iso(fim),
  });

  if (error) return { erro: "Não consegui cadastrar." };

  revalidatePath("/painel");
  return { ok: true, renovou: false };
}

/** Recebeu a mensalidade: empurra o ciclo e zera o consumo de créditos. */
export async function registrarMensalidade(assinaturaId: string) {
  const sessao = await exigirDono();
  const supabase = clienteServico();

  // A duração vem do plano: 30 dias, e não "um mês", que dá 28 em fevereiro.
  const { data: assinatura } = await supabase
    .from("subscriptions")
    .select("club_plans(duracao_dias)")
    .eq("id", assinaturaId)
    .eq("barbershop_id", sessao.barbeariaId)
    .maybeSingle();

  const p = Array.isArray(assinatura?.club_plans)
    ? assinatura?.club_plans[0]
    : assinatura?.club_plans;
  const dias = (p as { duracao_dias?: number } | null)?.duracao_dias ?? 30;

  const hoje = new Date();
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + dias);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "ativa",
      ciclo_inicio: iso(hoje),
      ciclo_fim: iso(fim),
      proxima_cobranca: iso(fim),
    })
    .eq("id", assinaturaId)
    .eq("barbershop_id", sessao.barbeariaId);

  if (error) return { erro: "Não consegui registrar." };

  revalidatePath("/painel");
  return { ok: true };
}

export async function cancelarAssinatura(assinaturaId: string) {
  const sessao = await exigirDono();

  const { error } = await clienteServico()
    .from("subscriptions")
    .update({ status: "cancelada", cancelada_em: new Date().toISOString() })
    .eq("id", assinaturaId)
    .eq("barbershop_id", sessao.barbeariaId);

  if (error) return { erro: "Não consegui cancelar." };

  revalidatePath("/painel");
  return { ok: true };
}

const servico = z.object({
  id: z.string().uuid().nullable(),
  nome: z.string().trim().min(2).max(60),
  categoria: z.string().trim().min(2).max(30),
  duracaoMin: z.coerce.number().int().min(5).max(480),
  preco: z.coerce.number().min(0).max(5000),
  cobertoPeloClube: z.boolean(),
  abate: z.coerce.number().min(0).max(5000),
  tag: z.string().trim().max(40).nullable(),
});

/**
 * Salva serviço novo ou existente. O abate do clube nunca passa do preço:
 * senão o crédito viraria troco.
 */
export async function salvarServico(entrada: z.input<typeof servico>) {
  const analise = servico.safeParse(entrada);
  if (!analise.success) return { erro: "Confira os campos do serviço." };

  const sessao = await exigirDono();
  const d = analise.data;
  const supabase = clienteServico();

  const linha = {
    barbershop_id: sessao.barbeariaId,
    nome: d.nome,
    categoria: d.categoria,
    duracao_min: d.duracaoMin,
    preco_centavos: Math.round(d.preco * 100),
    coberto_pelo_clube: d.cobertoPeloClube,
    abate_centavos: d.cobertoPeloClube
      ? Math.min(Math.round(d.abate * 100), Math.round(d.preco * 100))
      : 0,
    tag: d.tag || null,
  };

  const { error } = d.id
    ? await supabase.from("services").update(linha).eq("id", d.id)
    : await supabase.from("services").insert(linha);

  if (error) return { erro: "Não consegui salvar o serviço." };

  revalidatePath("/painel");
  revalidatePath("/agendar");
  revalidatePath("/bot");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Serviço sai da régua sem apagar: agendamento antigo continua apontando para
 * ele, e apagar quebraria o histórico.
 */
export async function alternarServico(servicoId: string, ativo: boolean) {
  const sessao = await exigirDono();

  const { error } = await clienteServico()
    .from("services")
    .update({ ativo })
    .eq("id", servicoId)
    .eq("barbershop_id", sessao.barbeariaId);

  if (error) return { erro: "Não consegui atualizar." };

  revalidatePath("/painel");
  revalidatePath("/agendar");
  revalidatePath("/bot");
  revalidatePath("/");
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

/**
 * Links de pagamento do PagBank, um por valor cobrado.
 *
 * O Johny cria cada link no app dele e cola a URL aqui. Enquanto a API de
 * pedidos não é liberada, é por aqui que sai o cartão — e apagar o campo
 * simplesmente tira o botão da tela do cliente, sem quebrar nada.
 */
export async function salvarLinksPagamento(
  _estado: { erro?: string; ok?: boolean } | null,
  formulario: FormData,
) {
  const sessao = await exigirDono();
  const supabase = clienteServico();

  const guardar: { valor: number; url: string }[] = [];
  const apagar: number[] = [];

  for (const [campo, bruto] of formulario.entries()) {
    const casa = campo.match(/^link_(\d+)$/);
    if (!casa) continue;

    const valor = Number(casa[1]);
    const url = String(bruto).trim();

    if (!url) {
      apagar.push(valor);
      continue;
    }

    // Só https: um link http aqui vira um cliente digitando cartão em aberto.
    if (!/^https:\/\/\S+$/.test(url)) {
      return { erro: "O link precisa começar com https://" };
    }

    guardar.push({ valor, url });
  }

  if (apagar.length) {
    const { error } = await supabase
      .from("payment_links")
      .delete()
      .eq("barbershop_id", sessao.barbeariaId)
      .in("valor_centavos", apagar);

    if (error) return { erro: "Não consegui remover um dos links." };
  }

  if (guardar.length) {
    const { error } = await supabase.from("payment_links").upsert(
      guardar.map((l) => ({
        barbershop_id: sessao.barbeariaId,
        valor_centavos: l.valor,
        url: l.url,
        ativo: true,
      })),
      { onConflict: "barbershop_id,valor_centavos" },
    );

    if (error) return { erro: "Não consegui salvar os links." };
  }

  revalidatePath("/painel");
  revalidatePath("/agendar");
  return { ok: true };
}

/**
 * Fila do WhatsApp: dar baixa e descartar.
 *
 * A fila só sabia crescer. `enfileirar` inseria e nada nunca marcava como
 * enviada, então o painel virou um monte de aviso velho que o Johny não tinha
 * como tirar — e o de ontem atrapalhava achar o de hoje.
 */
export async function darBaixaNoAviso(id: string) {
  const sessao = await exigirEquipe();

  await clienteServico()
    .from("notifications")
    .update({ status: "enviada", enviada_em: new Date().toISOString() })
    .eq("id", id)
    .eq("barbershop_id", sessao.barbeariaId)
    .eq("status", "pendente");

  revalidatePath("/painel");
  return { ok: true };
}

/** Descartar não apaga: marca como cancelada, e o histórico continua lá. */
export async function descartarAviso(id: string) {
  const sessao = await exigirEquipe();

  await clienteServico()
    .from("notifications")
    .update({ status: "cancelada" })
    .eq("id", id)
    .eq("barbershop_id", sessao.barbeariaId)
    .eq("status", "pendente");

  revalidatePath("/painel");
  return { ok: true };
}

/**
 * Limpar a fila inteira de uma vez. Só o dono, porque some com a tela toda de
 * quem estava trabalhando nela.
 */
export async function descartarTodosAvisos() {
  const sessao = await exigirDono();

  await clienteServico()
    .from("notifications")
    .update({ status: "cancelada" })
    .eq("barbershop_id", sessao.barbeariaId)
    .eq("status", "pendente");

  revalidatePath("/painel");
  return { ok: true };
}
