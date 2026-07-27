"use client";

import { useState } from "react";
import { SearchX } from "lucide-react";

import { filtrar, type AbaLista } from "@/lib/abas";

export function Lista({ aba }: { aba: AbaLista }) {
  const [filtro, setFiltro] = useState(aba.filtros[0]);
  const linhas = filtrar(aba, filtro);

  return (
    <section className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        {aba.filtros.map((f) => {
          const ativo = f === filtro;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              aria-pressed={ativo}
              className={`inline-flex min-h-toque items-center rounded-pill border px-4 font-titulo text-sm font-semibold transition-colors ${
                ativo
                  ? "border-acao bg-acao text-acao-sobre"
                  : "border-borda bg-superficie-ativa text-texto-suave hover:border-borda-forte"
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      {linhas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-card border border-borda bg-superficie-ativa px-4 py-12 text-center">
          <SearchX className="h-5 w-5 text-texto-apagado" strokeWidth={1.75} />
          <span className="font-titulo text-base font-semibold">
            {aba.vazio.titulo}
          </span>
          <span className="max-w-sm text-sm text-texto-suave">
            {aba.vazio.texto}
          </span>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {linhas.map((linha) => (
            <li
              key={linha.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-borda bg-superficie-ativa px-4 py-3"
            >
              <div className="flex min-w-0 flex-[1_1_58%] items-center gap-2 sm:flex-[1_1_34%]">
                {linha.ponto ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-pill bg-acao"
                    aria-label="assinante do clube"
                  />
                ) : null}
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-titulo text-sm font-semibold">
                    {linha.nome}
                  </span>
                  <span
                    className={`truncate text-xs ${
                      linha.tom === "alerta" ? "text-alerta" : "text-texto-suave"
                    }`}
                  >
                    {linha.contexto}
                  </span>
                </div>
              </div>

              <span className="num order-2 ml-auto shrink-0 font-titulo text-base font-bold text-texto sm:order-3 sm:w-[120px] sm:text-right">
                {linha.valor}
              </span>

              <span className="order-3 min-w-[110px] flex-1 truncate text-xs text-texto-suave sm:order-2 sm:text-right">
                {linha.metrica}
              </span>

              <button
                type="button"
                className={`order-4 inline-flex min-h-toque shrink-0 items-center rounded-pill border px-4 font-titulo text-sm font-semibold transition-colors ${
                  linha.tom === "alerta"
                    ? "border-alerta/60 text-alerta hover:bg-alerta/10"
                    : "border-borda-forte text-texto hover:border-acao"
                }`}
              >
                {linha.acao}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
