"use server";

import { z } from "zod";

import {
  horariosLivres,
  instante,
  menosOcupado,
} from "@/lib/agenda/disponibilidade";
import { casa } from "@/lib/dados/casa";
import { enfileirar } from "@/lib/notify/whatsapp";
import { provedorAtual } from "@/lib/payments/provider";
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

const reserva = z.object({
  data: z.string().regex(DATA),
  hora: z.string().regex(HORA),
  servicoId: z.string().uuid(),
  // null = "tanto faz, primeiro que liberar"
  barbeiroId: z.string().uuid().nullable(),
  nome: z.string().trim().min(2).max(80),
  telefone: z.string().trim().min(10).max(20),
  usarClube: z.boolean().default(false),
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
  assinatura_vencida: "Sua mensalidade está vencida — dá para pagar avulso.",
  servico_fora_do_clube: "Esse serviço não entra no clube.",
  creditos_esgotados: "Seus cortes do clube acabaram neste ciclo.",
  servico_indisponivel: "Esse serviço não está mais na régua.",
};

export type ResultadoReserva =
  | { ok: true; token: string; status: string; valorCentavos: number }
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

  const { data: criado, error } = await supabase.rpc("reservar", {
    p_barbearia: casaAtual.id,
    p_barbeiro: barbeiroId,
    p_servico: dados.servicoId,
    p_nome: dados.nome,
    p_telefone: dados.telefone.replace(/\D/g, ""),
    p_inicio: instante(dados.data, dados.hora).toISOString(),
    p_usar_clube: dados.usarClube,
    p_origem: "link",
  });

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

  // Pix só nasce quando há valor e a reserva está segurando o slot.
  if (
    agendamento.status === "pendente_pagamento" &&
    agendamento.valor_centavos > 0 &&
    casaAtual.pix_key
  ) {
    const cobranca = await provedorAtual().criarCobranca({
      barbeariaId: casaAtual.id,
      agendamentoId: agendamento.id,
      valorCentavos: agendamento.valor_centavos,
      chavePix: casaAtual.pix_key,
      titular: casaAtual.pix_titular ?? casaAtual.nome,
      cidade: casaAtual.cidade,
      minutos: casaAtual.reserva_minutos,
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
  }

  await enfileirar({
    barbeariaId: casaAtual.id,
    destino: "cliente",
    template: "agendamento_criado",
    telefone: dados.telefone,
    dados: {
      cliente: dados.nome.split(" ")[0],
      quando: `${dados.data.split("-").reverse().slice(0, 2).join("/")} às ${dados.hora}`,
      servico: "",
      barbeiro: "",
    },
  });

  return {
    ok: true,
    token: agendamento.token_cliente,
    status: agendamento.status,
    valorCentavos: agendamento.valor_centavos,
  };
}
