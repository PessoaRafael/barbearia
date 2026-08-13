import "server-only";

import { cache } from "react";

import { clienteServico } from "@/lib/supabase/servidor";
import { hojeNaCasa } from "@/lib/agenda/dias";
import type { Escopo } from "./painel";

/**
 * O fechamento do dia, do jeito que o dinheiro entra de verdade.
 *
 * O painel sempre somou o valor do agendamento, e para quem é do clube esse
 * valor é R$ 0 — o corte já está pago. Lendo só isso, um dia com dez cortes de
 * clube parecia um dia de R$ 0, o que não é verdade: aqueles dez clientes
 * pagam R$ 129,99 ou R$ 189,99 por mês.
 *
 * Então o relatório separa as duas naturezas:
 *
 *   avulso   — entra hoje, no valor do corte
 *   clube    — entrou no dia da mensalidade, e aqui aparece rateado por dia
 *
 * O rateio é mensalidade ÷ duração do ciclo. Não é dinheiro que caiu hoje: é
 * quanto daquela assinatura corresponde a um dia. Serve para o Johny comparar
 * um dia com o outro sem achar que o clube trabalha de graça.
 */

const um = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export type Relatorio = {
  dia: string;
  atendimentos: {
    total: number;
    concluidos: number;
    confirmados: number;
    cancelados: number;
    faltas: number;
    pendentes: number;
  };
  porBarbeiro: { nome: string; cortes: number; centavos: number }[];
  avulso: {
    recebido: number;
    aReceber: number;
    linhas: {
      hora: string;
      cliente: string;
      servico: string;
      barbeiro: string;
      centavos: number;
      pago: boolean;
    }[];
  };
  clube: {
    cortesNoDia: number;
    assinantes: number;
    mensalSomado: number;
    porDia: number;
    /** O que esses cortes custariam se a pessoa não fosse do clube. */
    valorDeTabela: number;
    porPlano: { nome: string; quantos: number; centavos: number }[];
  };
  caixa: { entradas: number; saidas: number };
  /** Avulso recebido + a parte do dia das mensalidades. */
  totalDoDia: number;
};

export const relatorioDoDia = cache(
  async (escopo: Escopo, dia = hojeNaCasa()): Promise<Relatorio> => {
    const supabase = clienteServico();

    const inicio = `${dia}T00:00:00-03:00`;
    const fim = `${dia}T23:59:59-03:00`;

    const [ags, assinaturas, entradas] = await Promise.all([
      supabase
        .from("appointments")
        .select(
          "inicio, status, valor_centavos, usou_credito_clube, service_id, clients(nome), services(nome, preco_centavos), barbers!barber_id(apelido), payments(status)",
        )
        .eq("barbershop_id", escopo.barbeariaId)
        .gte("inicio", inicio)
        .lte("inicio", fim)
        .order("inicio"),
      supabase
        .from("subscriptions")
        .select("preco_centavos, ciclo_inicio, ciclo_fim, club_plans(nome)")
        .eq("barbershop_id", escopo.barbeariaId)
        .eq("status", "ativa"),
      supabase
        .from("cash_entries")
        .select("tipo, valor_centavos")
        .eq("barbershop_id", escopo.barbeariaId)
        .eq("data", dia),
    ]);

    const lista = ags.data ?? [];

    const atendimentos = {
      total: lista.length,
      concluidos: lista.filter((a) => a.status === "concluido").length,
      confirmados: lista.filter((a) => a.status === "confirmado").length,
      cancelados: lista.filter((a) =>
        ["cancelado", "expirado"].includes(a.status as string),
      ).length,
      faltas: lista.filter((a) => a.status === "faltou").length,
      pendentes: lista.filter((a) => a.status === "pendente_pagamento").length,
    };

    // Cancelado e falta não contam em lugar nenhum: não houve atendimento.
    const valeram = lista.filter((a) =>
      ["confirmado", "concluido"].includes(a.status as string),
    );

    const porBarbeiro = new Map<string, { cortes: number; centavos: number }>();
    for (const a of valeram) {
      const nome = um<{ apelido: string }>(a.barbers as never)?.apelido ?? "—";
      const atual = porBarbeiro.get(nome) ?? { cortes: 0, centavos: 0 };
      atual.cortes += 1;
      atual.centavos += a.valor_centavos as number;
      porBarbeiro.set(nome, atual);
    }

    const doClube = valeram.filter((a) => a.usou_credito_clube);
    const avulsos = valeram.filter((a) => !a.usou_credito_clube);

    const pagoDe = (a: (typeof lista)[number]) => {
      const pgs = (Array.isArray(a.payments) ? a.payments : [a.payments]).filter(
        Boolean,
      ) as { status: string }[];
      // Sem cobrança registrada é dinheiro na cadeira: o corte aconteceu e o
      // valor entrou, só não passou por pix.
      if (!pgs.length) return a.status === "concluido";
      return pgs.some((p) => p.status === "confirmado");
    };

    const hora = (iso: string) =>
      new Date(iso).toLocaleTimeString("pt-BR", {
        timeZone: "America/Fortaleza",
        hour: "2-digit",
        minute: "2-digit",
      });

    const linhas = avulsos.map((a) => ({
      hora: hora(a.inicio as string),
      cliente: um<{ nome: string }>(a.clients as never)?.nome ?? "—",
      servico: um<{ nome: string }>(a.services as never)?.nome ?? "—",
      barbeiro: um<{ apelido: string }>(a.barbers as never)?.apelido ?? "—",
      centavos: a.valor_centavos as number,
      pago: pagoDe(a),
    }));

    const recebido = linhas
      .filter((l) => l.pago)
      .reduce((s, l) => s + l.centavos, 0);
    const aReceber = linhas
      .filter((l) => !l.pago)
      .reduce((s, l) => s + l.centavos, 0);

    // Quanto os cortes do clube custariam na tabela: é o valor que o assinante
    // deixou de pagar hoje porque já paga por mês.
    const valorDeTabela = doClube.reduce(
      (s, a) => s + (um<{ preco_centavos: number }>(a.services as never)?.preco_centavos ?? 0),
      0,
    );

    const assinaturas_ = assinaturas.data ?? [];
    const porPlano = new Map<string, { quantos: number; centavos: number }>();
    let mensalSomado = 0;
    let porDia = 0;

    for (const s of assinaturas_) {
      const preco = s.preco_centavos as number;
      mensalSomado += preco;

      // Ciclo real da assinatura, não 30 fixo: um plano de 15 dias vale o
      // dobro por dia de um mensal do mesmo preço.
      const dias = Math.max(
        1,
        Math.round(
          (new Date(s.ciclo_fim as string).getTime() -
            new Date(s.ciclo_inicio as string).getTime()) /
            86400000,
        ) + 1,
      );
      porDia += preco / dias;

      const nome = um<{ nome: string }>(s.club_plans as never)?.nome ?? "Clube";
      const atual = porPlano.get(nome) ?? { quantos: 0, centavos: 0 };
      atual.quantos += 1;
      atual.centavos += preco;
      porPlano.set(nome, atual);
    }

    const caixa = {
      entradas: (entradas.data ?? [])
        .filter((c) => c.tipo === "entrada")
        .reduce((s, c) => s + (c.valor_centavos as number), 0),
      saidas: (entradas.data ?? [])
        .filter((c) => c.tipo === "saida")
        .reduce((s, c) => s + (c.valor_centavos as number), 0),
    };

    return {
      dia,
      atendimentos,
      porBarbeiro: [...porBarbeiro.entries()]
        .map(([nome, v]) => ({ nome, ...v }))
        .sort((a, b) => b.cortes - a.cortes),
      avulso: { recebido, aReceber, linhas },
      clube: {
        cortesNoDia: doClube.length,
        assinantes: assinaturas_.length,
        mensalSomado,
        porDia: Math.round(porDia),
        valorDeTabela,
        porPlano: [...porPlano.entries()]
          .map(([nome, v]) => ({ nome, ...v }))
          .sort((a, b) => b.quantos - a.quantos),
      },
      caixa,
      totalDoDia: recebido + Math.round(porDia),
    };
  },
);
