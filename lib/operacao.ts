"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { BarbeiroId } from "@/agenda";
import { AGENDA_POR_DIA } from "@/painel";
import { servicoPorId } from "@/servicos";
import { slotsOcupados } from "./disponibilidade";

/**
 * O que o barbeiro mexe no dia a dia: quantas cadeiras o clube pode ocupar,
 * quais horários ele fechou na correria e o que foi marcado depois que a
 * página abriu.
 *
 * Sem back-end, isso vive no localStorage só para as duas telas concordarem:
 * bloqueou no painel, some do agendamento. Some quando o navegador limpa.
 */

export const TETO_CLUBE_PADRAO = 15;

export type Marcacao = {
  id: string;
  diaId: string;
  barbeiro: BarbeiroId;
  hora: string;
  servicoId: string;
  cliente: string;
  clube: boolean;
  origem: "site" | "painel";
};

export type Operacao = {
  /** Semana aberta para agendar. 0 é a corrente; renova na segunda. */
  semanaAberta: number;
  teto: Record<string, number>;
  bloqueios: string[];
  marcacoes: Marcacao[];
};

const CHAVE = "johny-operacao-v1";
const VAZIO: Operacao = {
  semanaAberta: 0,
  teto: {},
  bloqueios: [],
  marcacoes: [],
};

export const chaveSlot = (diaId: string, barbeiro: string, hora: string) =>
  `${diaId}|${barbeiro}|${hora}`;

/** Assinantes que já estavam na agenda do dia antes de qualquer marcação nova. */
export function clubeBase(diaId: string) {
  return (AGENDA_POR_DIA[diaId] ?? []).filter((a) => a.assinante).length;
}

export function useOperacao() {
  const [operacao, setOperacao] = useState<Operacao>(VAZIO);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(CHAVE);
      if (bruto) setOperacao({ ...VAZIO, ...JSON.parse(bruto) });
    } catch {
      // localStorage indisponível: segue com o estado em memória.
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(operacao));
    } catch {
      // idem
    }
  }, [operacao, carregado]);

  const tetoDo = useCallback(
    (diaId: string) => operacao.teto[diaId] ?? TETO_CLUBE_PADRAO,
    [operacao.teto],
  );

  const marcacoesDo = useCallback(
    (diaId: string) => operacao.marcacoes.filter((m) => m.diaId === diaId),
    [operacao.marcacoes],
  );

  const clubeUsado = useCallback(
    (diaId: string) =>
      clubeBase(diaId) +
      operacao.marcacoes.filter((m) => m.diaId === diaId && m.clube).length,
    [operacao.marcacoes],
  );

  const clubeCheio = useCallback(
    (diaId: string) => clubeUsado(diaId) >= tetoDo(diaId),
    [clubeUsado, tetoDo],
  );

  const estaBloqueado = useCallback(
    (diaId: string, barbeiro: string, hora: string) =>
      operacao.bloqueios.includes(chaveSlot(diaId, barbeiro, hora)),
    [operacao.bloqueios],
  );

  const alternarBloqueio = useCallback(
    (diaId: string, barbeiro: string, hora: string) => {
      const chave = chaveSlot(diaId, barbeiro, hora);
      setOperacao((atual) => ({
        ...atual,
        bloqueios: atual.bloqueios.includes(chave)
          ? atual.bloqueios.filter((b) => b !== chave)
          : [...atual.bloqueios, chave],
      }));
    },
    [],
  );

  const ajustarTeto = useCallback((diaId: string, valor: number) => {
    setOperacao((atual) => ({
      ...atual,
      teto: { ...atual.teto, [diaId]: Math.max(0, Math.min(40, valor)) },
    }));
  }, []);

  const marcar = useCallback((marcacao: Marcacao) => {
    setOperacao((atual) =>
      atual.marcacoes.some((m) => m.id === marcacao.id)
        ? atual
        : { ...atual, marcacoes: [...atual.marcacoes, marcacao] },
    );
  }, []);

  /**
   * Abre a semana seguinte, ou volta. Cada virada leva os bloqueios e as
   * marcações da semana antiga embora — a régua nova nasce limpa.
   */
  const virarSemana = useCallback((passo: number) => {
    setOperacao((atual) => {
      const alvo = Math.max(0, Math.min(8, atual.semanaAberta + passo));
      if (alvo === atual.semanaAberta) return atual;
      return { ...VAZIO, semanaAberta: alvo };
    });
  }, []);

  const limpar = useCallback(() => setOperacao(VAZIO), []);

  return {
    operacao,
    carregado,
    semanaAberta: operacao.semanaAberta,
    virarSemana,
    tetoDo,
    marcacoesDo,
    clubeUsado,
    clubeCheio,
    estaBloqueado,
    alternarBloqueio,
    ajustarTeto,
    marcar,
    limpar,
  };
}

/**
 * Slots que a agenda mockada não conhece: o que o barbeiro fechou na mão e o
 * que foi marcado depois. Chave `barbeiro|hora`, do jeito que
 * lib/disponibilidade espera.
 */
export function extrasDoDia(operacao: Operacao, diaId: string) {
  const extra = new Set<string>();

  for (const chave of operacao.bloqueios) {
    const [dia, barbeiro, hora] = chave.split("|");
    if (dia === diaId) extra.add(`${barbeiro}|${hora}`);
  }

  for (const m of operacao.marcacoes) {
    if (m.diaId !== diaId) continue;
    const duracao = servicoPorId(m.servicoId)?.duracaoMin ?? 30;
    for (const slot of slotsOcupados(m.hora, duracao)) {
      extra.add(`${m.barbeiro}|${slot}`);
    }
  }

  return extra;
}

/** Hook de conveniência: extras já memorizados para o dia aberto. */
export function useExtras(operacao: Operacao, diaId: string) {
  return useMemo(() => extrasDoDia(operacao, diaId), [operacao, diaId]);
}
