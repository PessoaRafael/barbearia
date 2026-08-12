import "server-only";

import { cache } from "react";

import { lerSessao, type Sessao } from "@/lib/auth/sessao";

/** O mínimo para ler os dados de uma tela: quem pergunta e de que casa. */
export type Escopo = { chaveId: string; barbeariaId: string };
import { clienteServico } from "@/lib/supabase/servidor";
import { hojeNaCasa } from "@/lib/agenda/dias";
import { diaDaSemana } from "@/lib/agenda/disponibilidade";

/**
 * Leituras do painel.
 *
 * A agenda e o resumo passam pelas funções do Postgres, que recortam por
 * papel: o barbeiro recebe só a própria coluna, mesmo pedindo a casa inteira.
 * O resto é do dono e já roda atrás de exigirDono.
 */

export type Marcado = {
  id: string;
  barber_id: string;
  barbeiro: string;
  inicio: string;
  fim: string;
  status: string;
  valor_centavos: number;
  usou_credito_clube: boolean;
  cliente: string;
  telefone: string;
  assinante: boolean;
  servico: string;
  duracao_min: number;
};

export async function agendaDoDia(
  sessao: Sessao,
  data = hojeNaCasa(),
  barbeiroId: string | null = null,
) {
  const { data: linhas } = await clienteServico().rpc("agenda_do_dia", {
    p_chave: sessao.chaveId,
    p_data: data,
    p_barbeiro: barbeiroId,
  });
  return (linhas ?? []) as Marcado[];
}

export type Bloqueio = {
  id: string;
  barber_id: string;
  inicio: string;
  fim: string;
  motivo: string | null;
};

export type Agenda = {
  marcados: Marcado[];
  bloqueios: Bloqueio[];
  barbeiros: { id: string; apelido: string }[];
  janela: { abre: string; fecha: string } | null;
};

/**
 * Tudo que a aba Agenda desenha, numa volta de rede só.
 *
 * Antes eram cinco leituras, duas delas em fila porque dependiam da lista de
 * barbeiros. O recorte por papel continua no Postgres: o barbeiro recebe só a
 * própria coluna.
 */
export const painelAgenda = cache(async function painelAgenda(
  escopo: Escopo,
  data = hojeNaCasa(),
): Promise<Agenda> {
  const { data: tudo, error } = await clienteServico().rpc("painel_agenda", {
    p_chave: escopo.chaveId,
    p_data: data,
  });

  if (!error && tudo) return tudo as Agenda;

  /**
   * Caminho antigo, para o painel não quebrar entre subir o código e rodar a
   * migration 0012. Some assim que ela estiver aplicada em todo lugar: mostrar
   * agenda vazia por causa de função ausente seria pior que ser lento, porque
   * o Johny acharia que o dia está livre.
   */
  console.warn(
    "painel_agenda indisponível, caindo no caminho antigo. Rodou a 0012?",
    error?.message,
  );

  // Só o caminho antigo precisa do papel, para recortar a agenda do barbeiro
  // fora do banco. A leitura da sessão já aconteceu nesta requisição.
  const sessao = await lerSessao();
  const vazio: Agenda = {
    marcados: [],
    bloqueios: [],
    barbeiros: [],
    janela: null,
  };
  if (!sessao) return vazio;

  const [marcados, bloqueios, janela, barbeiros] = await Promise.all([
    agendaDoDia(sessao, data),
    bloqueiosDoDia(sessao, data),
    janelaDoDia(sessao, data),
    clienteServico()
      .from("barbers")
      .select("id, apelido")
      .eq("barbershop_id", escopo.barbeariaId)
      .eq("ativo", true)
      .order("ordem"),
  ]);

  return {
    marcados,
    bloqueios: bloqueios as Bloqueio[],
    janela,
    barbeiros: (barbeiros.data ?? []) as { id: string; apelido: string }[],
  };
})

/**
 * Quantos horários entraram desde a última vez que esta chave abriu a agenda.
 *
 * Conta só o que ainda vale: expirado e cancelado entram e saem sozinhos, e
 * avisar sobre eles seria mandar o Johny procurar o que não existe.
 */
export const novosNaAgenda = cache(async (escopo: Escopo) => {
  const supabase = clienteServico();

  const { data: chave } = await supabase
    .from("access_keys")
    .select("agenda_vista_em")
    .eq("id", escopo.chaveId)
    .maybeSingle();

  // Primeira vez: mostra o que entrou nas últimas 24h, em vez de despejar o
  // histórico inteiro como se fosse novidade.
  const desde =
    chave?.agenda_vista_em ??
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", escopo.barbeariaId)
    .in("status", ["confirmado", "pendente_pagamento"])
    .gt("criado_em", desde);

  return { quantos: count ?? 0, desde };
});

/** Carimba que a agenda foi vista agora. Fora do caminho crítico. */
export async function marcarAgendaVista(escopo: Escopo) {
  await clienteServico()
    .from("access_keys")
    .update({ agenda_vista_em: new Date().toISOString() })
    .eq("id", escopo.chaveId);
}

/** cache() para o indicador e o crachá da barra lateral não pedirem duas vezes. */
export const resumoDoDia = cache(
  async (escopo: Escopo, data = hojeNaCasa()) => {
    const { data: resumo } = await clienteServico().rpc("resumo_do_dia", {
      p_chave: escopo.chaveId,
      p_data: data,
    });
    return (resumo ?? {
      marcados: 0,
      receita_centavos: 0,
      pix_pendentes: 0,
    }) as { marcados: number; receita_centavos: number; pix_pendentes: number };
  },
);

/**
 * Ids dos barbeiros da casa, uma vez por requisição.
 *
 * Várias leituras da agenda precisam desta lista antes da própria consulta.
 * Sem o cache, cada uma pagava a mesma volta de rede e ainda em fila, o que
 * fazia a aba Agenda ser a mais lenta do painel.
 */
const barbeirosDaCasa = cache(async (sessao: Sessao) => {
  const { data } = await clienteServico()
    .from("barbers")
    .select("id, ativo")
    .eq("barbershop_id", sessao.barbeariaId);

  return data ?? [];
});

/**
 * Janela em que a casa funciona nesse dia: o mais cedo que alguém abre e o
 * mais tarde que alguém fecha. É o limite do "fechar o resto do dia".
 */
export async function janelaDoDia(sessao: Sessao, data = hojeNaCasa()) {
  const supabase = clienteServico();

  const ids = (await barbeirosDaCasa(sessao))
    .filter((b) => b.ativo)
    .map((b) => b.id);
  if (!ids.length) return null;

  const { data: horas } = await supabase
    .from("working_hours")
    .select("abre, fecha")
    .in("barber_id", ids)
    .eq("dia_semana", diaDaSemana(data))
    .eq("ativo", true);

  if (!horas?.length) return null;

  const cedo = horas.map((h) => (h.abre as string).slice(0, 5)).sort();
  const tarde = horas.map((h) => (h.fecha as string).slice(0, 5)).sort();

  return { abre: cedo[0], fecha: tarde[tarde.length - 1] };
}

/** Bloqueios pontuais do dia, os que dá para soltar com um clique. */
export async function bloqueiosDoDia(sessao: Sessao, data = hojeNaCasa()) {
  const supabase = clienteServico();

  const ids = (await barbeirosDaCasa(sessao)).map((b) => b.id);
  const alvo = sessao.papel === "barber" ? [sessao.barbeiroId!] : ids;

  const { data: linhas } = await supabase
    .from("breaks")
    .select("id, barber_id, inicio, fim, motivo")
    .in("barber_id", alvo)
    .eq("data", data);

  return linhas ?? [];
}

export const pixParaConferir = cache(async (escopo: Escopo) => {
  const { data } = await clienteServico()
    .from("payments")
    .select(
      "id, valor_centavos, expira_em, criado_em, appointments(inicio, clients(nome, telefone), services(nome), barbers(apelido))",
    )
    .eq("barbershop_id", escopo.barbeariaId)
    .eq("status", "aguardando")
    .order("criado_em", { ascending: true });

  const um = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  return (data ?? []).map((p) => {
    const ag = um(p.appointments as never) as
      | {
          inicio: string;
          clients: unknown;
          services: unknown;
          barbers: unknown;
        }
      | null;
    const cliente = um(ag?.clients as never) as
      | { nome: string; telefone: string }
      | null;
    const servico = um(ag?.services as never) as { nome: string } | null;
    const barbeiro = um(ag?.barbers as never) as { apelido: string } | null;

    return {
      id: p.id,
      valorCentavos: p.valor_centavos,
      expiraEm: p.expira_em as string | null,
      cliente: cliente?.nome ?? "",
      telefone: cliente?.telefone ?? "",
      servico: servico?.nome ?? "",
      barbeiro: barbeiro?.apelido ?? "",
      inicio: ag?.inicio ?? "",
    };
  });
});

/** Equipe com o estado da chave de cada um. */
export const equipe = cache(async (escopo: Escopo) => {
  const supabase = clienteServico();

  const [{ data: barbeiros }, { data: chaves }] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, nome, apelido, especialidade, ativo")
      .eq("barbershop_id", escopo.barbeariaId)
      .order("ordem"),
    supabase
      .from("access_keys")
      .select("id, barber_id, key_prefix, criada_em, ultimo_acesso")
      .eq("barbershop_id", escopo.barbeariaId)
      .eq("role", "barber")
      .is("revogada_em", null),
  ]);

  return (barbeiros ?? []).map((b) => {
    const chave = (chaves ?? []).find((k) => k.barber_id === b.id);
    return {
      ...b,
      chave: chave
        ? {
            id: chave.id,
            prefixo: chave.key_prefix,
            criadaEm: chave.criada_em as string,
            ultimoAcesso: chave.ultimo_acesso as string | null,
          }
        : null,
    };
  });
});

export const assinantes = cache(async (escopo: Escopo) => {
  const supabase = clienteServico();

  const [{ data }, { data: chaves }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, client_id, status, preco_centavos, cortes_mes, ciclo_inicio, ciclo_fim, proxima_cobranca, clients(nome, telefone), club_plans(nome, dias_semana)",
      )
      .eq("barbershop_id", escopo.barbeariaId)
      .neq("status", "cancelada"),
    supabase
      .from("access_keys")
      .select("id, client_id, key_prefix, ultimo_acesso")
      .eq("barbershop_id", escopo.barbeariaId)
      .eq("role", "client")
      .is("revogada_em", null),
  ]);

  return (data ?? []).map((s) => {
    const c = Array.isArray(s.clients) ? s.clients[0] : s.clients;
    const pl = Array.isArray(s.club_plans) ? s.club_plans[0] : s.club_plans;
    const chave = (chaves ?? []).find((k) => k.client_id === s.client_id);

    return {
      id: s.id,
      clienteId: s.client_id as string,
      status: s.status as string,
      precoCentavos: s.preco_centavos,
      cortesMes: s.cortes_mes,
      cicloFim: s.ciclo_fim as string,
      proximaCobranca: s.proxima_cobranca as string,
      nome: (c as { nome?: string })?.nome ?? "",
      telefone: (c as { telefone?: string })?.telefone ?? "",
      plano: (pl as { nome?: string } | null)?.nome ?? null,
      chave: chave
        ? {
            id: chave.id,
            prefixo: chave.key_prefix as string,
            ultimoAcesso: chave.ultimo_acesso as string | null,
          }
        : null,
    };
  });
});

export const clientes = cache(async (escopo: Escopo) => {
  const { data } = await clienteServico()
    .from("clients")
    .select(
      "id, nome, telefone, total_cortes, total_gasto_centavos, faltas, ultimo_corte_em",
    )
    .eq("barbershop_id", escopo.barbeariaId)
    .order("ultimo_corte_em", { ascending: false, nullsFirst: false })
    .limit(200);

  return data ?? [];
});

export const servicos = cache(async (escopo: Escopo) => {
  const { data } = await clienteServico()
    .from("services")
    .select("*")
    .eq("barbershop_id", escopo.barbeariaId)
    .order("ordem");

  return data ?? [];
});

export const caixaDoDia = cache(async (escopo: Escopo, data = hojeNaCasa()) => {
  const { data: linhas } = await clienteServico()
    .from("cash_entries")
    .select("id, tipo, categoria, descricao, valor_centavos, barbers(apelido)")
    .eq("barbershop_id", escopo.barbeariaId)
    .eq("data", data)
    .order("criado_em", { ascending: false });

  return (linhas ?? []).map((l) => {
    const b = Array.isArray(l.barbers) ? l.barbers[0] : l.barbers;
    return {
      id: l.id,
      tipo: l.tipo as string,
      categoria: l.categoria as string,
      descricao: l.descricao as string | null,
      valorCentavos: l.valor_centavos as number,
      barbeiro: (b as { apelido?: string })?.apelido ?? "",
    };
  });
});

/** Quem quis um dia que já estava cheio e ainda não foi avisado. */
export const filaDeEspera = cache(async (escopo: Escopo) => {
  const { data } = await clienteServico()
    .from("waitlist")
    .select("id, data, clients(nome, telefone), services(nome), barbers(apelido)")
    .eq("barbershop_id", escopo.barbeariaId)
    .is("atendido_em", null)
    .gte("data", hojeNaCasa())
    .order("criado_em");

  const um = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  return (data ?? []).map((f) => {
    const cliente = um(f.clients as never) as
      | { nome: string; telefone: string }
      | null;
    const servico = um(f.services as never) as { nome: string } | null;
    const barbeiro = um(f.barbers as never) as { apelido: string } | null;

    return {
      id: f.id,
      data: f.data as string,
      nome: cliente?.nome ?? "",
      telefone: cliente?.telefone ?? "",
      servico: servico?.nome ?? "",
      barbeiro: barbeiro?.apelido ?? null,
    };
  });
});

/** Fila do WhatsApp esperando o Johny disparar. */
export const avisosPendentes = cache(async (escopo: Escopo) => {
  const { data } = await clienteServico()
    .from("notifications")
    .select("id, template, payload, telefone, criado_em")
    .eq("barbershop_id", escopo.barbeariaId)
    .eq("status", "pendente")
    .lte("agendada_para", new Date().toISOString())
    .order("agendada_para")
    .limit(30);

  return data ?? [];
});
