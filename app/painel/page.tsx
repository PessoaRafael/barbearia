"use client";

import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/componentes/base";
import { Agenda } from "@/componentes/painel/Agenda";
import { Indicadores } from "@/componentes/painel/Indicadores";
import { LateralAgenda, LateralGenerica } from "@/componentes/painel/Lateral";
import { Lista } from "@/componentes/painel/Lista";
import { Menu } from "@/componentes/painel/Menu";
import { ABAS, INDICADORES_AGENDA, type AbaLista } from "@/lib/abas";
import { CASA } from "@/lib/casa";

const AGENDA = {
  titulo: "Agenda",
  descricao: "Quem senta na cadeira hoje, por barbeiro e por horário.",
};

export default function Painel() {
  const [abaId, setAbaId] = useState("agenda");
  const aba = abaId === "agenda" ? null : ABAS[abaId as AbaLista["id"]];

  const cabecalho = aba
    ? { titulo: aba.titulo, descricao: aba.descricao }
    : AGENDA;
  const indicadores = aba ? aba.indicadores : INDICADORES_AGENDA;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-5 py-3 sm:px-8 lg:px-10">
          <Logo tamanho={36} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-titulo text-base font-bold leading-tight">
              {CASA.nome}
            </span>
            <span className="truncate text-xs text-texto-suave">
              painel do barbeiro
            </span>
          </div>
          <Link
            href="/"
            className="ml-auto inline-flex min-h-toque shrink-0 items-center rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
          >
            Ver o site
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-start lg:gap-6 lg:px-10">
        <div className="lg:sticky lg:top-[76px] lg:w-[240px] lg:shrink-0 xl:w-[256px]">
          <Menu atual={abaId} onTrocar={setAbaId} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 xl:flex-row xl:items-start xl:gap-6">
          <main className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl">{cabecalho.titulo}</h1>
              <p className="text-texto-suave">{cabecalho.descricao}</p>
            </div>

            <Indicadores itens={indicadores} />

            {aba ? <Lista key={aba.id} aba={aba} /> : <Agenda />}
          </main>

          <aside className="xl:sticky xl:top-[76px] xl:w-[320px] xl:shrink-0">
            {aba ? <LateralGenerica dados={aba.lateral} /> : <LateralAgenda />}
          </aside>
        </div>
      </div>
    </div>
  );
}
