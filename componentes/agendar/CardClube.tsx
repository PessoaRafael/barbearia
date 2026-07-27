"use client";

import { Crown } from "lucide-react";

import { CLIENTE_LOGADO, CLUBE } from "@/painel";
import { moeda } from "@/lib/formato";

export function CardClube({ usados }: { usados: number }) {
  const totais = CLIENTE_LOGADO.cortesTotais;
  const restantes = Math.max(0, totais - usados);
  const porcentagem = Math.round((usados / totais) * 100);

  return (
    <div className="flex flex-col gap-3 rounded-grande border border-borda bg-superficie p-4">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 shrink-0 text-clube" strokeWidth={2} />
        <span className="font-titulo text-sm font-semibold text-clube">
          {CLUBE.nome}
        </span>
        <span className="ml-auto truncate text-xs text-texto-suave">
          {CLIENTE_LOGADO.nome}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="num font-titulo text-3xl font-bold text-texto">
          {usados}
        </span>
        <span className="num text-sm text-texto-suave">
          de {totais} cortes usados
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-pill bg-superficie-apagada"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totais}
        aria-valuenow={usados}
        aria-label="cortes do clube usados no mês"
      >
        <div
          className="h-full rounded-pill bg-clube transition-all"
          style={{ width: `${porcentagem}%` }}
        />
      </div>

      <p className="text-xs text-texto-suave">
        {restantes > 0
          ? `Sobram ${restantes} cortes. Renova em ${CLIENTE_LOGADO.renovaEm}.`
          : `Cortes do mês esgotados. Renova em ${CLIENTE_LOGADO.renovaEm}.`}
      </p>
    </div>
  );
}

export type EtapaTrilha = { rotulo: string; valor: string | null };

export function TrilhaResumo({
  etapas,
  total,
}: {
  etapas: EtapaTrilha[];
  total: number | null;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4">
      <span className="text-xs uppercase tracking-wide text-texto-apagado">
        Sua escolha
      </span>

      <ol className="flex flex-col">
        {etapas.map((etapa, i) => {
          const feito = Boolean(etapa.valor);
          const ultimo = i === etapas.length - 1;
          return (
            <li key={etapa.rotulo} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`num grid h-6 w-6 shrink-0 place-items-center rounded-pill border font-titulo text-xs font-bold ${
                    feito
                      ? "border-acao bg-acao text-acao-sobre"
                      : "border-borda text-texto-apagado"
                  }`}
                >
                  {i + 1}
                </span>
                {!ultimo ? (
                  <span
                    className={`w-px flex-1 ${feito ? "bg-acao/50" : "bg-borda"}`}
                  />
                ) : null}
              </div>
              <div className={`flex flex-col ${ultimo ? "" : "pb-4"}`}>
                <span className="text-xs text-texto-apagado">{etapa.rotulo}</span>
                <span
                  className={`text-sm ${
                    feito ? "text-texto" : "text-texto-apagado"
                  }`}
                >
                  {etapa.valor ?? "a escolher"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-3 border-t border-borda pt-3">
        <span className="text-sm text-texto-suave">Total a pagar</span>
        <span
          className={`num font-titulo text-2xl font-bold ${
            total === null ? "text-texto-apagado" : "text-acao"
          }`}
        >
          {total === null ? "—" : moeda(total)}
        </span>
      </div>
    </div>
  );
}
