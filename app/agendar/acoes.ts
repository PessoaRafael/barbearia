"use server";

import { z } from "zod";

import {
  horariosLivres,
  instante,
  menosOcupado,
} from "@/lib/agenda/disponibilidade";
import { lerSessao } from "@/lib/auth/sessao";
import { casa } from "@/lib/dados/casa";
import { enfileirar } from "@/lib/notify/whatsapp";
import { provedorAtual } from "@/lib/payments/provider";
import { svgDoBrcode } from "@/lib/pix/qr";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Tudo que decide preço, horário ou crédito acontece aqui e no banco. A tela
 * só desenha: se ela mandar um horário ocupado ou um crédito que não existe, a
 * função do Postgres derruba.
 */

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

const consulta = z.object({
  data: z.string().regex(DATA),
  servicoId: z.string().uuid(),
  barbeiroId: z.string().uuid().nullable().optional(),
});

export async function buscarHorarios(entrada: z.input<typeof consulta>) {
  const { data, servicoId, barbeiroId } = consulta.parse(entrada);
  const { id } = await casa();

  const supabase = clienteServico();
  const { data: servico } = await supabase
    .from("services")
    .select("duracao_min")
    .eq("id", servicoId)
    .eq("barbershop_id", id)
    .maybeSingle();

  if (!servico) return [];

  return horariosLivres({
    barbeariaId: id,
    data,
    duracaoMin: servico.duracao_min,
    barbeiroId: barbeiroId ?? null,
  });
}

const fila = z.object({
  data: z.string().regex(DATA),
  servicoId: z.string().uuid(),
  barbeiroId: z.string().uuid().nullable(),
  nome: z.string().trim().min(2).max(80),
  telefone: z.string().trim().min(10).max(20),
});

/**
 * Dia cheio: em vez de perder o cliente, guarda o nome. Quando alguém cancela,
 * o cancelamento avisa quem está na fila daquele dia.
 */
export async function entrarNaFila(entrada: z.input<typeof fila>) {
  const analise = fila.safeParse(entrada);
  if (!analise.success) return { erro: "Confira nome e WhatsApp." };

  const d = analise.data;
  const telefone = d.telefone.replace(/\D/g, "");
  const { id } = await casa();
  const supabase = clienteServico();

  const { data: cliente } = await supabase
    .from("clients")
    .upsert(
      { barbershop_id: id, nome: d.nome, telefone },
      { onConflict: "barbershop_id,telefone" },
    )
    .select("id")
    .single();

  if (!cliente) return { erro: "Não consegui te colocar na fila agora." };

  // Um lugar por pessoa, por dia e por serviço.
  const { data: jaTem } = await supabase
    .from("waitlist")
    .select("id")
    .eq("client_id", cliente.id)
    .eq("data", d.data)
    .eq("service_id", d.servicoId)
    .is("atendido_em", null)
    .maybeSingle();

  if (jaTem) return { ok: true, jaEstava: true };

  const { error } = await supabase.from("waitlist").insert({
    barbershop_id: id,
    client_id: cliente.id,
    service_id: d.servicoId,
    barber_id: d.barbeiroId,
    data: d.data,
  });

  if (error) return { erro: "Não consegui te colocar na fila agora." };
  return { ok: true, jaEstava: false };
}

/** O plano do assinante: o que ele cobre e em que dias vale. */
/** O provedor de hoje precisa de CPF e e-mail para cobrar? */
export async function pagamentoPedeCpf() {
  return provedorAtual().pedeCpf;
}

export type PlanoDoCliente = {
  nome: string;
  precoCentavos: number;
  categorias: string[];
  diasSemana: number[];
};

export type Reconhecido = {
  nome: string | null;
  assinante: boolean;
  /** Clube sem limite de cortes: creditosRestantes vem Infinity. */
  ilimitado: boolean;
  cortesUsados: number;
  creditosRestantes: number;
  cicloAte: string | null;
  vencida: boolean;
  plano: PlanoDoCliente | null;
  /** Guardados no primeiro pagamento, para o cliente não redigitar. */
  email: string | null;
  cpf: string | null;
};

/**
 * O telefone é a identidade do cliente: sem cadastro, sem senha. Se houver
 * assinatura viva, devolve quantos cortes ainda cabem no ciclo.
 */
export async function reconhecerCliente(
  telefoneBruto: string,
): Promise<Reconhecido> {
  const vazio: Reconhecido = {
    nome: null,
    assinante: false,
    ilimitado: false,
    cortesUsados: 0,
    creditosRestantes: 0,
    cicloAte: null,
    vencida: false,
    plano: null,
    email: null,
    cpf: null,
  };

  const telefone = telefoneBruto.replace(/\D/g, "");
  if (telefone.length < 10) return vazio;

  const { id } = await casa();
  const supabase = clienteServico();

  const { data: cliente } = await supabase
    .from("clients")
    .select("id, nome, email, cpf")
    .eq("barbershop_id", id)
    .eq("telefone", telefone)
    .maybeSingle();

  if (!cliente) return vazio;

  const { data: assinatura } = await supabase
    .from("subscriptions")
    .select(
      "id, status, cortes_mes, ciclo_inicio, ciclo_fim, club_plans(nome, preco_centavos, cobre_categorias, dias_semana)",
    )
    .eq("client_id", cliente.id)
    .neq("status", "cancelada")
    .maybeSingle();

  const contato = { email: cliente.email ?? null, cpf: cliente.cpf ?? null };

  if (!assinatura) return { ...vazio, ...contato, nome: cliente.nome };

  const vencida =
    assinatura.status === "vencida" ||
    new Date(assinatura.ciclo_fim) < new Date();

  // Crédito só conta o que não foi cancelado: desistir não custa corte.
  const { data: usos } = await supabase
    .from("subscription_uses")
    .select("appointment_id, appointments(status)")
    .eq("subscription_id", assinatura.id)
    .gte("usado_em", assinatura.ciclo_inicio);

  const gastos = (usos ?? []).filter((u) => {
    const ag = Array.isArray(u.appointments) ? u.appointments[0] : u.appointments;
    return ag?.status !== "cancelado";
  }).length;

  // Zero em cortes_mes é ilimitado. Devolvo Infinity para quem consome não
  // precisar conhecer a convenção: comparar com > 0 continua funcionando.
  const ilimitado = assinatura.cortes_mes === 0;

  const bruto = Array.isArray(assinatura.club_plans)
    ? assinatura.club_plans[0]
    : assinatura.club_plans;
  const p = bruto as {
    nome: string;
    preco_centavos: number;
    cobre_categorias: string[];
    dias_semana: number[];
  } | null;

  return {
    ...contato,
    nome: cliente.nome,
    assinante: !vencida,
    ilimitado,
    cortesUsados: gastos,
    creditosRestantes: ilimitado
      ? Number.POSITIVE_INFINITY
      : Math.max(0, assinatura.cortes_mes - gastos),
    cicloAte: assinatura.ciclo_fim,
    vencida,
    plano: p
      ? {
          nome: p.nome,
          precoCentavos: p.preco_centavos,
          categorias: p.cobre_categorias ?? [],
          diasSemana: p.dias_semana ?? [],
        }
      : null,
  };
}

/**
 * Quem já entrou com a chave do clube não precisa se apresentar de novo.
 *
 * Roda depois que a tela carrega, e não no servidor da página, de propósito: o
 * /agendar é estático e serve para todo mundo. Ler cookie no render tornaria a
 * página dinâmica para os anônimos também, que são a maioria.
 */
export async function sessaoDoCliente(): Promise<{
  nome: string;
  telefone: string;
  reconhecido: Reconhecido;
} | null> {
  const sessao = await lerSessao();
  if (!sessao || sessao.papel !== "client" || !sessao.clienteId) return null;

  const { data: cliente } = await clienteServico()
    .from("clients")
    .select("nome, telefone")
    .eq("id", sessao.clienteId)
    .maybeSingle();

  if (!cliente) return null;

  return {
    nome: cliente.nome,
    telefone: cliente.telefone,
    reconhecido: await reconhecerCliente(cliente.telefone),
  };
}

/**
 * O horário já confirmou?
 *
 * Existe para a tela do cliente se atualizar sozinha depois que ele paga. Com
 * o pix automático, a confirmação chega por webhook a qualquer momento, e sem
 * isso ele ficaria olhando um "aguardando o pix" que já não é verdade —
 * dependendo de uma mensagem no WhatsApp para descobrir.
 *
 * Recebe o token do agendamento, que é secreto e só quem marcou tem. Não
 * devolve nada além do estado: serve para uma tela, não para vasculhar agenda.
 */
export async function situacaoDoAgendamento(token: string) {
  if (!token || token.length < 8) return null;

  const { data } = await clienteServico()
    .from("appointments")
    .select("status, valor_centavos")
    .eq("token_cliente", token)
    .maybeSingle();

  if (!data) return null;
  return { status: data.status as string, valorCentavos: data.valor_centavos };
}

const reserva = z.object({
  data: z.string().regex(DATA),
  hora: z.string().regex(HORA),
  servicoId: z.string().uuid(),
  // null = "tanto faz, primeiro que liberar"
  barbeiroId: z.string().uuid().nullable(),
  nome: z.string().trim().min(2).max(80),
  telefone: z.string().trim().min(10).max(20),
  usarClube: z.boolean().default(false),
  formaPagamento: z.enum(["pix", "cadeira", "clube"]).default("cadeira"),
  /** Por onde a pessoa marcou. O bot passa "chat"; o formulário, "link". */
  origem: z.enum(["link", "chat"]).default("link"),
  /** Só quando o provedor de pagamento exige. Ver `provedorAtual().pedeCpf`. */
  email: z.string().trim().email().max(120).optional(),
  cpf: z.string().trim().max(20).optional(),
});

/** Mensagens que o cliente entende, no lugar do código de erro do Postgres. */
const RECADOS: Record<string, string> = {
  horario_ocupado:
    "Esse horário acabou de ser preenchido. Escolha outro na grade.",
  horario_no_passado: "Esse horário já passou.",
  fora_do_expediente: "A casa não atende nesse horário.",
  horario_bloqueado: "Esse horário está bloqueado.",
  casa_fechada: "A barbearia está fechada nesse dia.",
  sem_assinatura_ativa: "Não achei assinatura ativa nesse telefone.",
  assinatura_vencida: "Sua mensalidade está vencida, dá para pagar avulso.",
  servico_fora_do_clube: "Esse serviço não entra no seu plano do clube.",
  dia_fora_do_clube:
    "Quem é do clube marca de segunda a quinta. Escolha um desses dias.",
  plano_inexistente: "Não achei o plano da sua assinatura. Fale com o Johny.",
  creditos_esgotados: "Seus cortes do clube acabaram neste ciclo.",
  servico_indisponivel: "Esse serviço não está mais na régua.",
};

export type Pix = {
  brcode: string;
  qrSvg: string | null;
  chave: string;
  titular: string;
  /** Telefone da barbearia, para o cliente avisar que pagou. */
  whatsapp: string | null;
  expiraEm: string;
  minutos: number;
};

export type ResultadoReserva =
  | {
      ok: true;
      token: string;
      status: string;
      valorCentavos: number;
      barbeiro: string;
      pix: Pix | null;
    }
  | { ok: false; erro: string };

export async function reservar(
  entrada: z.input<typeof reserva>,
): Promise<ResultadoReserva> {
  const analise = reserva.safeParse(entrada);
  if (!analise.success) return { ok: false, erro: "Dados incompletos." };

  const dados = analise.data;
  const casaAtual = await casa();
  const supabase = clienteServico();

  // "Tanto faz" vira um barbeiro concreto antes de entrar na transação.
  let barbeiroId = dados.barbeiroId;
  if (!barbeiroId) {
    const livres = await buscarHorarios({
      data: dados.data,
      servicoId: dados.servicoId,
    });
    const nesteHorario = livres.find((l) => l.hora === dados.hora);
    if (!nesteHorario?.barbeiros.length) {
      return { ok: false, erro: RECADOS.horario_ocupado };
    }
    barbeiroId = await menosOcupado(
      casaAtual.id,
      dados.data,
      nesteHorario.barbeiros,
    );
  }

  const marcar = (origem: string) =>
    supabase.rpc("reservar", {
      p_barbearia: casaAtual.id,
      p_barbeiro: barbeiroId,
      p_servico: dados.servicoId,
      p_nome: dados.nome,
      p_telefone: dados.telefone.replace(/\D/g, ""),
      p_inicio: instante(dados.data, dados.hora).toISOString(),
      p_usar_clube: dados.usarClube,
      p_origem: origem,
    });

  let { data: criado, error } = await marcar(dados.origem);

  /**
   * 'chat' só existe no enum depois da 0018. Entre subir este código e rodar a
   * migration, insistir derrubaria todo agendamento feito pelo bot. Perder a
   * etiqueta de origem é bem mais barato que perder o agendamento.
   */
  if (error && /invalid input value for enum/i.test(error.message)) {
    ({ data: criado, error } = await marcar("link"));
  }

  if (error) {
    const chave = Object.keys(RECADOS).find((k) => error.message.includes(k));
    return {
      ok: false,
      erro: chave
        ? RECADOS[chave]
        : "Não consegui marcar agora. Tente de novo em instantes.",
    };
  }

  const agendamento = criado as {
    id: string;
    token_cliente: string;
    status: string;
    valor_centavos: number;
  };

  // Pix nasce quando há valor a pagar. Se a reserva está segurando o slot,
  // ele também carrega o prazo; se o pagamento é opcional, é só a comodidade
  // de pagar antes.
  let pix: Pix | null = null;
  const querPix =
    dados.formaPagamento === "pix" || agendamento.status === "pendente_pagamento";

  if (querPix && agendamento.valor_centavos > 0 && casaAtual.pix_key) {
    const cpf = (dados.cpf ?? "").replace(/\D/g, "");

    // Guarda para a próxima vez: quem já pagou uma vez não redigita.
    if (dados.email || cpf) {
      await supabase
        .from("clients")
        .update({
          ...(dados.email ? { email: dados.email } : {}),
          ...(cpf ? { cpf } : {}),
        })
        .eq("id", (criado as { client_id: string }).client_id);
    }

    const cobranca = await provedorAtual().criarCobranca({
      barbeariaId: casaAtual.id,
      agendamentoId: agendamento.id,
      valorCentavos: agendamento.valor_centavos,
      chavePix: casaAtual.pix_key,
      titular: casaAtual.pix_titular ?? casaAtual.nome,
      cidade: casaAtual.cidade,
      minutos: casaAtual.reserva_minutos,
      cliente: {
        nome: dados.nome,
        telefone: dados.telefone,
        email: dados.email ?? null,
        cpf: cpf || null,
      },
    });

    await supabase.from("payments").insert({
      barbershop_id: casaAtual.id,
      appointment_id: agendamento.id,
      metodo: "pix",
      valor_centavos: agendamento.valor_centavos,
      status: "aguardando",
      txid: cobranca.txid,
      brcode: cobranca.brcode,
      expira_em: cobranca.expiraEm.toISOString(),
    });

    pix = {
      brcode: cobranca.brcode,
      qrSvg: await svgDoBrcode(cobranca.brcode).catch(() => null),
      chave: casaAtual.pix_key,
      titular: casaAtual.pix_titular ?? casaAtual.nome,
      whatsapp: casaAtual.telefone,
      expiraEm: cobranca.expiraEm.toISOString(),
      minutos: casaAtual.reserva_minutos,
    };
  }

  // Nome do barbeiro e do serviço antes de escrever a mensagem: eles ficavam
  // vazios, e o cliente recebia "está marcado: com , 07/08 às 08:30".
  const [{ data: quem }, { data: oQue }] = await Promise.all([
    supabase.from("barbers").select("apelido").eq("id", barbeiroId).maybeSingle(),
    supabase
      .from("services")
      .select("nome")
      .eq("id", dados.servicoId)
      .maybeSingle(),
  ]);

  await enfileirar({
    barbeariaId: casaAtual.id,
    destino: "cliente",
    template: "agendamento_criado",
    telefone: dados.telefone,
    dados: {
      cliente: dados.nome.split(" ")[0],
      quando: `${dados.data.split("-").reverse().slice(0, 2).join("/")} às ${dados.hora}`,
      servico: oQue?.nome ?? "seu horário",
      barbeiro: quem?.apelido ?? "a equipe",
    },
  });

  return {
    ok: true,
    token: agendamento.token_cliente,
    status: agendamento.status,
    valorCentavos: agendamento.valor_centavos,
    barbeiro: quem?.apelido ?? "",
    pix,
  };
}
