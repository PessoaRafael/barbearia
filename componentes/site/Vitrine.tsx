"use client";

import { useState } from "react";
import {
  ArrowRight,
  Baby,
  Droplets,
  Eye,
  Flame,
  Scissors,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react";

import { Etiqueta } from "@/componentes/base";
import { moedaCentavos } from "@/lib/formato";

export type ItemVitrine = {
  id: string;
  nome: string;
  categoria: string;
  duracaoMin: number;
  precoCentavos: number;
  tag: string | null;
};

/**
 * A régua de serviços da landing.
 *
 * Era uma lista de linhas com nome e preço, agrupada por categoria. Funcionava,
 * mas obrigava a ler tudo para descobrir o que a casa mais faz — e o que a
 * pessoa quer saber primeiro é "quanto custa um corte normal".
 *
 * Agora abre nos mais escolhidos e o resto fica a um toque. As categorias
 * viram filtro em vez de títulos empilhados, que no celular davam uma rolagem
 * inteira só de cabeçalho.
 */

/**
 * Ícone por serviço.
 *
 * Escolhido pelo nome, com a categoria como rede: serviço novo nasce com o
 * ícone da categoria dele em vez de nascer sem nada. Sem isso, cada preço que
 * o Johny cadastrasse deixaria um buraco na tela até alguém lembrar de mexer
 * aqui.
 */
function IconeDo({ nome, categoria }: { nome: string; categoria: string }) {
  const n = nome.toLowerCase();
  const classe = "h-5 w-5";

  if (n.includes("criança")) return <Baby className={classe} strokeWidth={1.75} />;
  if (n.includes("sobrancelha")) return <Eye className={classe} strokeWidth={1.75} />;
  if (n.includes("hidrata")) return <Droplets className={classe} strokeWidth={1.75} />;
  if (n.includes("progressiva") || n.includes("alisante"))
    return <Wand2 className={classe} strokeWidth={1.75} />;
  if (n.includes("barba")) return <Sparkles className={classe} strokeWidth={1.75} />;

  if (categoria === "Química")
    return <Droplets className={classe} strokeWidth={1.75} />;
  if (categoria === "Acabamento")
    return <Sparkles className={classe} strokeWidth={1.75} />;

  return <Scissors className={classe} strokeWidth={1.75} />;
}

const DESTAQUE = "Mais escolhidos";

export function Vitrine({ servicos }: { servicos: ItemVitrine[] }) {
  const categorias = [...new Set(servicos.map((s) => s.categoria))];

  // Quem o Johny marcou com etiqueta é quem a casa mais vende. Sem nenhum
  // marcado, os três primeiros da régua fazem o papel.
  const marcados = servicos.filter((s) => s.tag);
  const destaques = (marcados.length ? marcados : servicos).slice(0, 3);

  const [aba, setAba] = useState(DESTAQUE);

  const lista =
    aba === DESTAQUE ? destaques : servicos.filter((s) => s.categoria === aba);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Chip
          rotulo={DESTAQUE}
          icone={<Star className="h-4 w-4" strokeWidth={2.5} />}
          ativo={aba === DESTAQUE}
          onClick={() => setAba(DESTAQUE)}
        />
        {categorias.map((c) => (
          <Chip
            key={c}
            rotulo={c}
            conta={servicos.filter((s) => s.categoria === c).length}
            ativo={aba === c}
            onClick={() => setAba(c)}
          />
        ))}
      </div>

      {aba === DESTAQUE ? (
        <p className="flex items-center gap-2 text-sm text-texto-suave">
          <Flame className="h-4 w-4 shrink-0 text-acao" strokeWidth={2} />
          O que mais sai da cadeira.
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((s) => (
          <li key={s.id}>
            <div className="flex h-full flex-col gap-3 rounded-grande border border-borda bg-superficie p-4 transition-colors hover:border-borda-forte">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill border border-borda-forte text-acao">
                  <IconeDo nome={s.nome} categoria={s.categoria} />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-titulo text-base font-semibold leading-tight">
                    {s.nome}
                  </span>
                  <span className="num text-xs text-texto-suave">
                    {s.duracaoMin} min
                  </span>
                </div>

                {s.tag ? <Etiqueta tom="neutro">{s.tag}</Etiqueta> : null}
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 border-t border-borda pt-3">
                <span className="num font-titulo text-xl font-bold text-acao">
                  {moedaCentavos(s.precoCentavos)}
                </span>
                <a
                  href="/agendar"
                  className="inline-flex min-h-toque items-center gap-1.5 rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao hover:text-acao"
                >
                  Marcar
                  <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} />
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({
  rotulo,
  conta,
  icone,
  ativo,
  onClick,
}: {
  rotulo: string;
  conta?: number;
  icone?: React.ReactNode;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`inline-flex min-h-toque items-center gap-2 rounded-pill border px-4 font-titulo text-sm font-semibold transition-colors ${
        ativo
          ? "border-acao bg-acao text-acao-sobre"
          : "border-borda bg-superficie text-texto-suave hover:border-borda-forte"
      }`}
    >
      {icone}
      {rotulo}
      {conta ? (
        <span
          className={`num text-xs ${ativo ? "text-acao-sobre/70" : "text-texto-apagado"}`}
        >
          {conta}
        </span>
      ) : null}
    </button>
  );
}
