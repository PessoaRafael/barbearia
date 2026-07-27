"use client";

import { Check, Lock } from "lucide-react";

export type EstadoPasso = "aberto" | "resumo" | "pendente" | "travado";

export function Passo({
  numero,
  titulo,
  estado,
  resumo,
  motivo,
  acaoPendente = "escolher",
  onAbrir,
  children,
}: {
  numero: number;
  titulo: string;
  estado: EstadoPasso;
  resumo?: React.ReactNode;
  motivo?: string;
  acaoPendente?: string;
  onAbrir?: () => void;
  children?: React.ReactNode;
}) {
  const travado = estado === "travado";
  const concluido = estado === "resumo";

  return (
    <section
      className={`flex flex-col rounded-grande border transition-colors ${
        estado === "aberto"
          ? "border-borda-forte bg-superficie"
          : "border-borda bg-superficie/60"
      }`}
      aria-labelledby={`passo-${numero}`}
    >
      <header className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <span
          className={`num grid h-7 w-7 shrink-0 place-items-center rounded-pill font-titulo text-xs font-bold ${
            concluido
              ? "bg-acao text-acao-sobre"
              : estado === "aberto"
                ? "border border-acao text-acao"
                : "border border-borda text-texto-apagado"
          }`}
        >
          {concluido ? <Check className="h-4 w-4" strokeWidth={3} /> : numero}
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <h2
            id={`passo-${numero}`}
            className={`font-titulo text-base font-semibold leading-tight ${
              travado ? "text-texto-apagado" : "text-texto"
            }`}
          >
            {titulo}
          </h2>
          {concluido && resumo ? (
            <div className="truncate text-sm text-texto-suave">{resumo}</div>
          ) : null}
          {travado && motivo ? (
            <span className="flex items-center gap-1.5 text-xs text-texto-apagado">
              <Lock className="h-3.5 w-3.5" strokeWidth={2} />
              {motivo}
            </span>
          ) : null}
        </div>

        {concluido || estado === "pendente" ? (
          <button
            type="button"
            onClick={onAbrir}
            className="-mr-2 inline-flex min-h-toque shrink-0 items-center rounded-pill px-3 font-titulo text-sm font-semibold text-acao transition-colors hover:text-acao-hover"
          >
            {concluido ? "trocar" : acaoPendente}
          </button>
        ) : null}
      </header>

      {estado === "aberto" ? (
        <div className="flex flex-col gap-4 border-t border-borda px-4 pb-5 pt-4 sm:px-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}
