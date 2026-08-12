"use client";

import { useMemo, useState } from "react";

import { moedaCentavos, telefoneBonito } from "@/lib/formato";
import {
  achatar,
  CampoBusca,
  Filtro,
  POR_VEZ,
  TrilhoDeFiltros,
  VerMais,
} from "./Lista";

export type ClienteDaCasa = {
  id: string;
  nome: string;
  telefone: string;
  total_cortes: number;
  total_gasto_centavos: number;
  faltas: number;
  ultimo_corte_em: string | null;
};

/** Quem não aparece há mais de 45 dias. O Johny chama isso de "sumido". */
const DIAS_SUMIDO = 45;

const sumiu = (c: ClienteDaCasa) => {
  if (!c.ultimo_corte_em) return false;
  const dias = (Date.now() - new Date(c.ultimo_corte_em).getTime()) / 86400000;
  return dias > DIAS_SUMIDO;
};

export function Clientes({ lista }: { lista: ClienteDaCasa[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [quantos, setQuantos] = useState(POR_VEZ);

  const sumidos = lista.filter(sumiu);
  const faltosos = lista.filter((c) => c.faltas > 0);

  const filtrados = useMemo(() => {
    const termo = achatar(busca.trim());
    const digitos = busca.replace(/\D/g, "");

    return lista.filter((c) => {
      if (filtro === "sumidos" && !sumiu(c)) return false;
      if (filtro === "faltas" && !c.faltas) return false;
      if (!termo) return true;

      return (
        achatar(c.nome).includes(termo) ||
        (digitos.length >= 3 && c.telefone.includes(digitos))
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
      <h2 className="text-lg">Clientes · {lista.length}</h2>

      {lista.length > 8 ? (
        <div className="flex flex-col gap-2">
          <CampoBusca
            valor={busca}
            onMudar={(v) => {
              setBusca(v);
              setQuantos(POR_VEZ);
            }}
            placeholder="Buscar por nome ou WhatsApp"
          />

          <TrilhoDeFiltros>
            <Filtro
              rotulo="Todos"
              conta={lista.length}
              ativo={filtro === "todos"}
              onClick={() => trocar("todos")}
            />
            {sumidos.length ? (
              <Filtro
                rotulo={`Sem vir há ${DIAS_SUMIDO} dias`}
                conta={sumidos.length}
                ativo={filtro === "sumidos"}
                onClick={() => trocar("sumidos")}
              />
            ) : null}
            {faltosos.length ? (
              <Filtro
                rotulo="Com falta"
                conta={faltosos.length}
                alerta
                ativo={filtro === "faltas"}
                onClick={() => trocar("faltas")}
              />
            ) : null}
          </TrilhoDeFiltros>
        </div>
      ) : null}

      {lista.length === 0 ? (
        <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-10 text-center text-sm text-texto-suave">
          A base começa a encher no primeiro agendamento.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-10 text-center text-sm text-texto-suave">
          Ninguém encontrado com esse nome ou número.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {mostrando.map((c) => (
            /* Empilhado: nome e total na primeira linha, o resto na largura
               toda. Em 360px a linha única espremia tudo e cortava o telefone. */
            <li
              key={c.id}
              className="flex flex-col gap-0.5 rounded-card border border-borda bg-superficie-ativa px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-titulo text-sm font-semibold">
                  {c.nome}
                </span>
                <span className="num shrink-0 font-titulo text-base font-bold">
                  {moedaCentavos(c.total_gasto_centavos)}
                </span>
              </div>

              <span className="num text-xs text-texto-suave">
                {telefoneBonito(c.telefone)} · {c.total_cortes} cortes
                {c.faltas ? ` · ${c.faltas} falta${c.faltas > 1 ? "s" : ""}` : ""}
              </span>
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
