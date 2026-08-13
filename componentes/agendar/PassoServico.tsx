"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";

import { Etiqueta } from "@/componentes/base";
import { moedaCentavos } from "@/lib/formato";
import { duracaoLabel, type Servico } from "./tipos";

/**
 * Escolha de serviço, somando.
 *
 * A primeira versão usava caixinha de marcar, e caixinha em lista de preço
 * parece formulário de cadastro, não loja. Aqui cada linha tem um botão de
 * adicionar, e quem já entrou aparece marcado — é o padrão dos aplicativos de
 * salão, e é o que a pessoa já sabe usar sem ler nada.
 *
 * O resumo fica no fim da lista e não numa barra fixa: já existe uma no rodapé
 * com o total e o Confirmar, e duas barras presas na mesma tela comem metade
 * do celular.
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
      <div className="flex flex-wrap gap-2">
        {categorias.map((c) => {
          const ativa = c === categoria;
          // Quantos desta categoria já entraram: sem isso, quem escolhe a
          // barba e volta para "Cortes" acha que perdeu a escolha.
          const quantos = escolhidos.filter((s) => s.categoria === c).length;

          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={ativa}
              className={`inline-flex min-h-toque flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill border px-3 font-titulo text-sm font-semibold transition-colors sm:flex-none ${
                ativa
                  ? "border-acao bg-acao text-acao-sobre"
                  : "border-borda bg-superficie-ativa text-texto-suave hover:border-borda-forte"
              }`}
            >
              {c}
              {quantos ? (
                <span
                  className={`num grid h-5 min-w-5 place-items-center rounded-pill px-1 text-xs ${
                    ativa ? "bg-acao-sobre/25" : "bg-acao/15 text-acao"
                  }`}
                >
                  {quantos}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-card border border-borda bg-superficie-ativa">
        {lista.map((s) => {
          const dentro = marcados.has(s.id);
          const travado = noLimite && !dentro;

          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onAlternar(s.id)}
                disabled={travado}
                aria-pressed={dentro}
                aria-label={
                  dentro ? `Tirar ${s.nome}` : `Adicionar ${s.nome}`
                }
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                  dentro
                    ? "bg-acao/10"
                    : travado
                      ? "opacity-40"
                      : "hover:bg-superficie"
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-titulo text-base font-semibold leading-tight">
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
                  className={`num shrink-0 font-titulo text-base font-bold ${
                    dentro ? "text-acao" : "text-texto"
                  }`}
                >
                  {moedaCentavos(s.precoCentavos)}
                </span>

                {/* Não é botão de verdade: a linha inteira já é clicável, e um
                    botão dentro do outro quebraria o toque no celular. */}
                <span
                  aria-hidden
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-pill border transition-colors ${
                    dentro
                      ? "border-acao bg-acao text-acao-sobre"
                      : "border-borda-forte text-texto-suave"
                  }`}
                >
                  {dentro ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Fica embaixo da lista de propósito: em cima, ninguém lê. Aqui ela
          aparece quando a pessoa acabou de escolher e está decidindo se para
          por aí — que é o momento em que a frase serve para alguma coisa. */}
      {escolhidos.length === 0 ? (
        <p className="text-xs text-texto-apagado">
          Pode juntar mais de um. Corte e barba no mesmo horário, por exemplo.
        </p>
      ) : null}

      {noLimite ? (
        <p className="text-xs text-texto-apagado">
          Até {limite} por horário. Para mais que isso, fale com a barbearia.
        </p>
      ) : null}

      {escolhidos.length ? (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {escolhidos.map((s) => (
              <li key={s.id} className="flex items-baseline gap-2 text-sm">
                <Check
                  className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-acao"
                  strokeWidth={3}
                />
                <span className="min-w-0 flex-1 truncate text-texto">
                  {s.nome}
                </span>
                <span className="num shrink-0 text-texto-suave">
                  {moedaCentavos(s.precoCentavos)}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-baseline justify-between gap-3 border-t border-borda pt-3">
            <span className="num text-sm text-texto-suave">
              {escolhidos.length === 1
                ? "1 serviço"
                : `${escolhidos.length} serviços`}
              {" · "}
              {duracaoLabel(minutos)}
            </span>
            <span className="num font-titulo text-2xl font-bold text-acao">
              {moedaCentavos(preco)}
            </span>
          </div>

          <button
            type="button"
            onClick={onPronto}
            className="inline-flex min-h-toque items-center justify-center rounded-pill bg-acao px-6 font-titulo text-base font-bold text-acao-sobre transition-colors hover:bg-acao-hover"
          >
            Escolher o dia
          </button>
        </div>
      ) : null}
    </div>
  );
}
