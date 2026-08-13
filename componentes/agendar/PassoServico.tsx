"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Etiqueta } from "@/componentes/base";
import { moedaCentavos } from "@/lib/formato";
import { duracaoLabel, type Servico } from "./tipos";

/**
 * Escolha de serviço, agora somando.
 *
 * Um cliente tentou marcar cabelo com barba e não conseguiu: dava para
 * escolher um só. Ele saía, entrava de novo, e ainda assim a agenda reservava
 * o tempo de um serviço — o barbeiro levava 45 minutos num buraco de 30.
 *
 * Aqui ele marca quantos quiser e vê o total de tempo e de preço subindo
 * enquanto escolhe. Tocar de novo tira da lista.
 */
export function PassoServico({
  servicos,
  escolhidos,
  onAlternar,
  onPronto,
  limite = 4,
}: {
  servicos: Servico[];
  escolhidos: Servico[];
  onAlternar: (id: string) => void;
  onPronto: () => void;
  limite?: number;
}) {
  const categorias = [...new Set(servicos.map((s) => s.categoria))];
  const [categoria, setCategoria] = useState(
    escolhidos[0]?.categoria ?? categorias[0],
  );
  const lista = servicos.filter((s) => s.categoria === categoria);

  const marcados = new Set(escolhidos.map((s) => s.id));
  const minutos = escolhidos.reduce((t, s) => t + s.duracaoMin, 0);
  const preco = escolhidos.reduce((t, s) => t + s.precoCentavos, 0);
  const noLimite = escolhidos.length >= limite;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {categorias.map((c) => {
          const ativa = c === categoria;
          // Quantos desta categoria já estão no carrinho: sem isso, quem
          // escolhe a barba e volta para "Cortes" acha que perdeu a escolha.
          const quantos = escolhidos.filter((s) => s.categoria === c).length;

          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={ativa}
              className={`inline-flex min-h-toque items-center justify-center gap-1.5 rounded-pill border px-3 font-titulo text-sm font-semibold transition-colors ${
                ativa
                  ? "border-acao bg-acao text-acao-sobre"
                  : "border-borda bg-superficie-ativa text-texto-suave hover:border-borda-forte"
              }`}
            >
              {c}
              {quantos ? (
                <span
                  className={`num grid h-5 min-w-5 place-items-center rounded-pill px-1 text-xs ${
                    ativa ? "bg-acao-sobre/20" : "bg-acao/15 text-acao"
                  }`}
                >
                  {quantos}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col gap-2">
        {lista.map((s) => {
          const ativo = marcados.has(s.id);
          // Cheio: o que já está marcado continua clicável para desmarcar.
          const travado = noLimite && !ativo;

          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onAlternar(s.id)}
                disabled={travado}
                aria-pressed={ativo}
                className={`flex w-full items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors ${
                  ativo
                    ? "border-acao bg-superficie-ativa"
                    : travado
                      ? "border-borda bg-superficie-ativa opacity-40"
                      : "border-borda bg-superficie-ativa hover:border-borda-forte"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors ${
                    ativo
                      ? "border-acao bg-acao text-acao-sobre"
                      : "border-borda-forte"
                  }`}
                >
                  {ativo ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                </span>

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

      {noLimite ? (
        <p className="text-xs text-texto-apagado">
          Até {limite} serviços por horário. Para mais, marque outro horário ou
          fale com a barbearia.
        </p>
      ) : null}

      {escolhidos.length ? (
        <div className="flex flex-col gap-3 rounded-card border border-acao/40 bg-superficie-ativa p-4">
          <ul className="flex flex-col gap-1.5">
            {escolhidos.map((s) => (
              <li
                key={s.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate text-texto">{s.nome}</span>
                <span className="num shrink-0 text-texto-suave">
                  {duracaoLabel(s.duracaoMin)} · {moedaCentavos(s.precoCentavos)}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-baseline justify-between gap-3 border-t border-borda pt-3">
            <span className="font-titulo text-sm font-semibold text-texto">
              {escolhidos.length === 1
                ? "1 serviço"
                : `${escolhidos.length} serviços`}
              {" · "}
              <span className="num font-normal text-texto-suave">
                {duracaoLabel(minutos)}
              </span>
            </span>
            <span className="num font-titulo text-xl font-bold text-acao">
              {moedaCentavos(preco)}
            </span>
          </div>

          <button
            type="button"
            onClick={onPronto}
            className="inline-flex min-h-toque items-center justify-center rounded-pill bg-acao px-6 font-titulo text-sm font-bold text-acao-sobre transition-colors hover:bg-acao-hover"
          >
            Escolher o dia
          </button>
        </div>
      ) : null}
    </div>
  );
}
