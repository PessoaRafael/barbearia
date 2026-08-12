"use client";

import { useMemo, useState } from "react";

import { moedaCentavos } from "@/lib/formato";
import {
  achatar,
  CampoBusca,
  Filtro,
  POR_VEZ,
  TrilhoDeFiltros,
  VerMais,
} from "./Lista";

export type Lancamento = {
  id: string;
  tipo: string;
  categoria: string;
  descricao: string | null;
  valorCentavos: number;
  barbeiro: string;
};

export function Caixa({ lista }: { lista: Lancamento[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [quantos, setQuantos] = useState(POR_VEZ);

  // O saldo é sempre do dia inteiro, não do que está filtrado na tela: número
  // do caixa que muda quando você digita na busca não serve para conferir.
  const total = lista.reduce(
    (soma, l) => soma + (l.tipo === "entrada" ? l.valorCentavos : -l.valorCentavos),
    0,
  );

  const categorias = [...new Set(lista.map((l) => l.categoria))];

  const filtrados = useMemo(() => {
    const termo = achatar(busca.trim());

    return lista.filter((l) => {
      if (filtro !== "todos" && l.categoria !== filtro) return false;
      if (!termo) return true;

      return (
        achatar(l.categoria).includes(termo) ||
        achatar(l.descricao ?? "").includes(termo) ||
        achatar(l.barbeiro).includes(termo)
      );
    });
  }, [lista, busca, filtro]);

  const mostrando = filtrados.slice(0, quantos);

  const trocar = (valor: string) => {
    setFiltro(valor);
    setQuantos(POR_VEZ);
  };

  return (
    <section className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4 sm:p-5">
      <h2 className="text-lg">Caixa do dia</h2>

      <div className="flex items-baseline justify-between gap-3 rounded-card border border-borda bg-superficie-ativa px-4 py-3">
        <span className="text-sm text-texto-suave">Entrou hoje</span>
        <span className="num font-titulo text-2xl font-bold text-acao">
          {moedaCentavos(total)}
        </span>
      </div>

      {lista.length > 8 ? (
        <div className="flex flex-col gap-2">
          <CampoBusca
            valor={busca}
            onMudar={(v) => {
              setBusca(v);
              setQuantos(POR_VEZ);
            }}
            placeholder="Buscar por categoria, barbeiro ou descrição"
          />

          <TrilhoDeFiltros>
            <Filtro
              rotulo="Tudo"
              conta={lista.length}
              ativo={filtro === "todos"}
              onClick={() => trocar("todos")}
            />
            {categorias.map((c) => (
              <Filtro
                key={c}
                rotulo={c}
                conta={lista.filter((l) => l.categoria === c).length}
                ativo={filtro === c}
                onClick={() => trocar(c)}
              />
            ))}
          </TrilhoDeFiltros>
        </div>
      ) : null}

      {lista.length === 0 ? (
        <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-10 text-center text-sm text-texto-suave">
          Nada lançado ainda. Entra automático quando um corte é concluído ou um
          pix é confirmado.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-10 text-center text-sm text-texto-suave">
          Nenhum lançamento com esse termo.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {mostrando.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-0.5 rounded-card border border-borda bg-superficie-ativa px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-titulo text-sm font-semibold">
                  {l.categoria}
                </span>
                <span
                  className={`num shrink-0 font-titulo text-base font-bold ${
                    l.tipo === "entrada" ? "text-texto" : "text-alerta"
                  }`}
                >
                  {l.tipo === "entrada" ? "" : "−"}
                  {moedaCentavos(l.valorCentavos)}
                </span>
              </div>

              {l.descricao || l.barbeiro ? (
                <span className="text-xs text-texto-suave">
                  {l.descricao}
                  {l.barbeiro ? ` · ${l.barbeiro}` : ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {lista.length > 8 ? (
        <VerMais
          mostrando={mostrando.length}
          total={filtrados.length}
          geral={lista.length}
          onMais={() => setQuantos((n) => n + POR_VEZ)}
        />
      ) : null}
    </section>
  );
}
