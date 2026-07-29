"use client";

import { useState } from "react";

import { Etiqueta } from "@/componentes/base";
import { moedaCentavos } from "@/lib/formato";
import { duracaoLabel, type Servico } from "./tipos";

export function PassoServico({
  servicos,
  escolhido,
  onEscolher,
}: {
  servicos: Servico[];
  escolhido: Servico | null;
  onEscolher: (id: string) => void;
}) {
  const categorias = [...new Set(servicos.map((s) => s.categoria))];
  const [categoria, setCategoria] = useState(
    escolhido?.categoria ?? categorias[0],
  );
  const lista = servicos.filter((s) => s.categoria === categoria);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {categorias.map((c) => {
          const ativa = c === categoria;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={ativa}
              className={`inline-flex min-h-toque items-center justify-center rounded-pill border px-3 font-titulo text-sm font-semibold transition-colors ${
                ativa
                  ? "border-acao bg-acao text-acao-sobre"
                  : "border-borda bg-superficie-ativa text-texto-suave hover:border-borda-forte"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col gap-2">
        {lista.map((s) => {
          const ativo = escolhido?.id === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onEscolher(s.id)}
                className={`flex w-full items-center gap-4 rounded-card border px-4 py-3 text-left transition-colors ${
                  ativo
                    ? "border-acao bg-superficie-ativa"
                    : "border-borda bg-superficie-ativa hover:border-borda-forte"
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-titulo text-base font-semibold">
                      {s.nome}
                    </span>
                    {s.tag ? (
                      <Etiqueta tom={s.tag.includes("clube") ? "clube" : "neutro"}>
                        {s.tag}
                      </Etiqueta>
                    ) : null}
                  </span>
                  <span className="num text-xs text-texto-suave">
                    {duracaoLabel(s.duracaoMin)}
                  </span>
                </span>
                <span
                  className={`num font-titulo text-lg font-bold ${
                    ativo ? "text-acao" : "text-texto"
                  }`}
                >
                  {moedaCentavos(s.precoCentavos)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
