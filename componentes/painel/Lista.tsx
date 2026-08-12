"use client";

import { Search, X } from "lucide-react";

/**
 * Os controles de lista do painel, num lugar só.
 *
 * Clube, Clientes e Caixa mostram a mesma coisa: uma lista que ficou grande
 * demais para rolar. Escrever busca e paginação três vezes garantiria que elas
 * fossem divergindo — uma limpando o campo, outra não, cada uma com um tamanho
 * de página.
 */

/** Sem acento e em minúscula: "Ângelo" tem que aparecer digitando "angelo". */
export const achatar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const POR_VEZ = 12;

export function CampoBusca({
  valor,
  onMudar,
  placeholder,
}: {
  valor: string;
  onMudar: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative flex items-center">
      <Search
        className="pointer-events-none absolute left-3.5 h-4 w-4 text-texto-apagado"
        strokeWidth={2}
      />
      <input
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-toque w-full rounded-pill border border-borda bg-superficie-ativa pl-10 pr-12 text-sm text-texto placeholder:text-texto-apagado"
      />
      {valor ? (
        <button
          type="button"
          onClick={() => onMudar("")}
          aria-label="Limpar busca"
          className="absolute right-2 grid h-9 w-9 place-items-center rounded-pill text-texto-apagado hover:text-texto"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </label>
  );
}

export function Filtro({
  rotulo,
  conta,
  ativo,
  alerta = false,
  onClick,
}: {
  rotulo: string;
  conta: number;
  ativo: boolean;
  alerta?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`inline-flex min-h-toque shrink-0 items-center gap-2 rounded-pill border px-4 font-titulo text-sm font-semibold transition-colors ${
        ativo
          ? "border-acao bg-acao text-acao-sobre"
          : alerta
            ? "border-alerta/50 bg-superficie-ativa text-alerta"
            : "border-borda bg-superficie-ativa text-texto-suave hover:border-borda-forte"
      }`}
    >
      {rotulo}
      <span className="num text-xs opacity-70">{conta}</span>
    </button>
  );
}

/**
 * Trilho horizontal no celular: os filtros não cabem em linha, e quebrar em
 * duas fileiras come a tela antes de a lista aparecer.
 */
export function TrilhoDeFiltros({ children }: { children: React.ReactNode }) {
  return (
    <div className="trilho -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {children}
    </div>
  );
}

export function VerMais({
  mostrando,
  total,
  geral,
  onMais,
}: {
  mostrando: number;
  total: number;
  /** Tamanho da lista sem filtro, para dizer quanto ficou de fora. */
  geral: number;
  onMais: () => void;
}) {
  return (
    <>
      {total > mostrando ? (
        <button
          type="button"
          onClick={onMais}
          className="inline-flex min-h-toque items-center justify-center rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
        >
          Ver mais {total - mostrando}
        </button>
      ) : null}

      <p className="num text-xs text-texto-apagado">
        mostrando {mostrando} de {total}
        {total !== geral ? ` (${geral} no total)` : ""}
      </p>
    </>
  );
}
