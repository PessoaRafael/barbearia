"use client";

import { useState } from "react";
import Image from "next/image";

export type LinhaMural = {
  id: string;
  hora: string;
  cliente: string;
  servico: string;
  status: string;
  clube: boolean;
  /** Calculado no servidor: a tela se redesenha a cada minuto de qualquer jeito. */
  naCadeira: boolean;
  passou: boolean;
};

export type Coluna = {
  barbeiroId: string;
  nome: string;
  foto: string | null;
  marcados: LinhaMural[];
};

/**
 * As colunas do mural, em dois formatos.
 *
 * No tablet da bancada, que é o uso de verdade, as três ficam lado a lado. No
 * celular não cabem: em 390px cada uma teria 130px, e nome de cliente não
 * entra nisso. Empilhar também não serve — rolar a agenda inteira do Johny
 * para chegar no Davi é pior que não ter a tela.
 *
 * Então no telefone vira uma de cada vez, com os rostos como seletor.
 */
export function Colunas({ colunas }: { colunas: Coluna[] }) {
  const [aberta, setAberta] = useState(0);
  const atual = colunas[aberta] ?? colunas[0];

  return (
    <>
      {/* Celular: escolhe de quem é a coluna. */}
      <div className="flex flex-col gap-3 p-4 sm:hidden">
        <div className="flex gap-2">
          {colunas.map((c, i) => (
            <button
              key={c.barbeiroId}
              type="button"
              onClick={() => setAberta(i)}
              aria-pressed={i === aberta}
              className={`flex min-h-toque flex-1 items-center justify-center gap-2 rounded-pill border px-2 font-titulo text-sm font-bold transition-colors ${
                i === aberta
                  ? "border-acao bg-acao text-acao-sobre"
                  : "border-borda bg-superficie text-texto-suave"
              }`}
            >
              <Rosto coluna={c} tamanho={28} />
              <span className="truncate">{c.nome}</span>
              <span className="num text-xs opacity-70">{c.marcados.length}</span>
            </button>
          ))}
        </div>

        {atual ? <Lista marcados={atual.marcados} /> : null}
      </div>

      {/**
        * Tablet e computador: todas de uma vez, que é o uso da bancada.
        *
        * O número de colunas segue o número de barbeiros, e não um ponto de
        * corte fixo. Com `sm:grid-cols-2 lg:grid-cols-3`, o tablet de 712px
        * caía em duas colunas e o terceiro barbeiro quebrava para baixo,
        * deixando um quadrado vazio ao lado — a tela ficava dividida em quatro
        * para mostrar três.
        */}
      <div
        className="hidden gap-px bg-borda sm:grid"
        style={{
          gridTemplateColumns: `repeat(${Math.min(colunas.length, 4)}, minmax(0, 1fr))`,
        }}
      >
        {colunas.map((c) => (
          <section key={c.barbeiroId} className="flex flex-col gap-3 bg-fundo p-3 sm:p-4 lg:p-5">
            <div className="flex items-center gap-3 border-b border-borda pb-3">
              <Rosto coluna={c} tamanho={40} />
              <span className="truncate font-titulo text-base font-bold sm:text-lg lg:text-xl">
                {c.nome}
              </span>
              <span className="num ml-auto text-sm text-texto-apagado">
                {c.marcados.length}
              </span>
            </div>
            <Lista marcados={c.marcados} />
          </section>
        ))}
      </div>
    </>
  );
}

/**
 * O rosto do barbeiro.
 *
 * Ancorado no topo: num recorte quadrado, cortar pelo meio come a cabeça de
 * quem está posando.
 */
function Rosto({ coluna, tamanho }: { coluna: Coluna; tamanho: number }) {
  if (!coluna.foto) {
    return (
      <span
        style={{ width: tamanho, height: tamanho }}
        className="grid shrink-0 place-items-center rounded-pill border border-borda bg-superficie-ativa font-titulo text-xs font-bold text-texto-suave"
      >
        {coluna.nome.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={coluna.foto}
      alt={coluna.nome}
      width={tamanho}
      height={tamanho}
      style={{ width: tamanho, height: tamanho }}
      className="shrink-0 rounded-pill border border-borda object-cover object-top"
    />
  );
}

function Lista({ marcados }: { marcados: LinhaMural[] }) {
  if (!marcados.length) {
    return <p className="text-sm text-texto-apagado">Sem horário hoje.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {marcados.map((m) => (
        <li
          key={m.id}
          className={`flex items-center gap-2.5 rounded-card border px-3 py-3 sm:gap-3 sm:px-3.5 lg:gap-4 lg:px-4 ${
            m.naCadeira
              ? "border-acao bg-acao/10"
              : m.passou
                ? "border-transparent opacity-40"
                : "border-borda bg-superficie"
          }`}
        >
          <span
            className={`num shrink-0 font-titulo text-xl font-bold tabular-nums sm:text-2xl lg:text-3xl ${
              m.naCadeira ? "text-acao" : "text-texto"
            }`}
          >
            {m.hora}
          </span>

          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-titulo text-base font-semibold leading-tight sm:text-lg lg:text-xl">
              {m.cliente}
            </span>
            <span className="truncate text-xs text-texto-suave sm:text-sm">
              {m.servico}
            </span>
          </span>

          {m.status === "faltou" ? (
            <span className="shrink-0 font-titulo text-xs font-bold uppercase tracking-wide text-alerta">
              faltou
            </span>
          ) : m.clube ? (
            <span className="shrink-0 rounded-pill bg-clube px-2 py-0.5 font-titulo text-[11px] font-bold uppercase tracking-wide text-fundo sm:px-2.5 sm:py-1 sm:text-xs">
              clube
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
