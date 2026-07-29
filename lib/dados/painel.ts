import "server-only";

import type { Sessao } from "@/lib/auth/sessao";
import { clienteServico } from "@/lib/supabase/servidor";
import { hojeNaCasa } from "@/lib/agenda/dias";

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

export async function resumoDoDia(sessao: Sessao, data = hojeNaCasa()) {
  const { data: resumo } = await clienteServico().rpc("resumo_do_dia", {
    p_chave: sessao.chaveId,
    p_data: data,
  });
  return (resumo ?? {
    marcados: 0,
    receita_centavos: 0,
    pix_pendentes: 0,
  }) as { marcados: number; receita_centavos: number; pix_pendentes: number };
}

/** Bloqueios pontuais do dia — os que dá para soltar com um clique. */
export async function bloqueiosDoDia(sessao: Sessao, data = hojeNaCasa()) {
  const supabase = clienteServico();
  const { data: barbeiros } = await supabase
    .from("barbers")
    .select("id")
    .eq("barbershop_id", sessao.barbeariaId);

  const ids = (barbeiros ?? []).map((b) => b.id);
  const alvo = sessao.papel === "barber" ? [sessao.barbeiroId!] : ids;

  const { data: linhas } = await supabase
    .from("breaks")
    .select("id, barber_id, inicio, fim, motivo")
    .in("barber_id", alvo)
    .eq("data", data);

  return linhas ?? [];
}

export async function pixParaConferir(sessao: Sessao) {
  const { data } = await clienteServico()
    .from("payments")
    .select(
      "id, valor_centavos, expira_em, criado_em, appointments(inicio, clients(nome, telefone), services(nome), barbers(apelido))",
    )
    .eq("barbershop_id", sessao.barbeariaId)
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
}

/** Equipe com o estado da chave de cada um. */
export async function equipe(sessao: Sessao) {
  const supabase = clienteServico();

  const [{ data: barbeiros }, { data: chaves }] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, nome, apelido, especialidade, ativo")
      .eq("barbershop_id", sessao.barbeariaId)
      .order("ordem"),
    supabase
      .from("access_keys")
      .select("id, barber_id, key_prefix, criada_em, ultimo_acesso")
      .eq("barbershop_id", sessao.barbeariaId)
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
}

export async function assinantes(sessao: Sessao) {
  const { data } = await clienteServico()
    .from("subscriptions")
    .select(
      "id, status, preco_centavos, cortes_mes, ciclo_inicio, ciclo_fim, proxima_cobranca, clients(nome, telefone)",
    )
    .eq("barbershop_id", sessao.barbeariaId)
    .neq("status", "cancelada");

  return (data ?? []).map((s) => {
    const c = Array.isArray(s.clients) ? s.clients[0] : s.clients;
    return {
      id: s.id,
      status: s.status as string,
      precoCentavos: s.preco_centavos,
      cortesMes: s.cortes_mes,
      cicloFim: s.ciclo_fim as string,
      proximaCobranca: s.proxima_cobranca as string,
      nome: (c as { nome?: string })?.nome ?? "",
      telefone: (c as { telefone?: string })?.telefone ?? "",
    };
  });
}

export async function clientes(sessao: Sessao) {
  const { data } = await clienteServico()
    .from("clients")
    .select(
      "id, nome, telefone, total_cortes, total_gasto_centavos, faltas, ultimo_corte_em",
    )
    .eq("barbershop_id", sessao.barbeariaId)
    .order("ultimo_corte_em", { ascending: false, nullsFirst: false })
    .limit(200);

  return data ?? [];
}

export async function servicos(sessao: Sessao) {
  const { data } = await clienteServico()
    .from("services")
    .select("*")
    .eq("barbershop_id", sessao.barbeariaId)
    .order("ordem");

  return data ?? [];
}

export async function caixaDoDia(sessao: Sessao, data = hojeNaCasa()) {
  const { data: linhas } = await clienteServico()
    .from("cash_entries")
    .select("id, tipo, categoria, descricao, valor_centavos, barbers(apelido)")
    .eq("barbershop_id", sessao.barbeariaId)
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
}

/** Quem quis um dia que já estava cheio e ainda não foi avisado. */
export async function filaDeEspera(sessao: Sessao) {
  const { data } = await clienteServico()
    .from("waitlist")
    .select("id, data, clients(nome, telefone), services(nome), barbers(apelido)")
    .eq("barbershop_id", sessao.barbeariaId)
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
}

/** Fila do WhatsApp esperando o Johny disparar. */
export async function avisosPendentes(sessao: Sessao) {
  const { data } = await clienteServico()
    .from("notifications")
    .select("id, template, payload, telefone, criado_em")
    .eq("barbershop_id", sessao.barbeariaId)
    .eq("status", "pendente")
    .lte("agendada_para", new Date().toISOString())
    .order("agendada_para")
    .limit(30);

  return data ?? [];
}
