"use client";

import { useState } from "react";
import { CalendarOff, MoonStar } from "lucide-react";

import { BARBEIROS, DIAS, EXPEDIENTE } from "@/agenda";
import { AGENDA_POR_DIA, type Agendamento } from "@/painel";
import { minutos } from "@/lib/formato";
import { rotuloDia } from "@/lib/disponibilidade";

const PX_POR_MIN = 1.5;
const INICIO = EXPEDIENTE.abre * 60;
const FIM = EXPEDIENTE.fecha * 60;
const ALTURA = (FIM - INICIO) * PX_POR_MIN;
const ALTURA_MINIMA = 34;
const COMPACTO_ATE = 52;
const COLUNA_HORAS = 52;

const HORAS = Array.from(
  { length: EXPEDIENTE.fecha - EXPEDIENTE.abre + 1 },
  (_, i) => EXPEDIENTE.abre + i,
);

/** Só hoje, amanhã e domingo entram na régua do painel. */
const DIAS_PAINEL = DIAS.filter((d) => ["d0", "d1", "d6"].includes(d.id));

export function Agenda() {
  const [diaId, setDiaId] = useState("d0");
  const dia = DIAS.find((d) => d.id === diaId);
  const agendamentos = AGENDA_POR_DIA[diaId] ?? [];

  const colunas = `${COLUNA_HORAS}px repeat(${BARBEIROS.length}, minmax(112px, 1fr))`;

  return (
    <section className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Agenda do dia</h2>
        <div className="trilho flex gap-2 overflow-x-auto">
          {DIAS_PAINEL.map((d) => {
            const ativo = d.id === diaId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDiaId(d.id)}
                aria-pressed={ativo}
                className={`inline-flex min-h-toque shrink-0 items-center rounded-pill border px-4 font-titulo text-sm font-semibold transition-colors ${
                  ativo
                    ? "border-acao bg-acao text-acao-sobre"
                    : "border-borda bg-superficie-ativa text-texto-suave hover:border-borda-forte"
                }`}
              >
                {rotuloDia(d.id)}
              </button>
            );
          })}
        </div>
      </header>

      {dia?.fechado ? (
        <Vazio
          icone={<MoonStar className="h-5 w-5" strokeWidth={1.75} />}
          titulo="Domingo a casa fecha"
          texto="Nenhum barbeiro na escala e nada marcado."
        />
      ) : agendamentos.length === 0 ? (
        <Vazio
          icone={<CalendarOff className="h-5 w-5" strokeWidth={1.75} />}
          titulo="Nenhum agendamento nesse dia"
          texto="A régua está vazia. Mande o link de agendamento para o grupo."
        />
      ) : (
        <div className="trilho overflow-x-auto">
          <div className="min-w-[480px]">
            <div className="grid pb-2" style={{ gridTemplateColumns: colunas }}>
              <span />
              {BARBEIROS.map((b) => (
                <div key={b.id} className="flex flex-col px-1">
                  <span className="font-titulo text-sm font-semibold">
                    {b.nome}
                  </span>
                  <span className="num text-xs text-texto-suave">
                    {agendamentos.filter((a) => a.barbeiro === b.id).length} na
                    régua
                  </span>
                </div>
              ))}
            </div>

            <div
              className="relative grid"
              style={{ gridTemplateColumns: colunas, height: ALTURA }}
            >
              {HORAS.map((h, i) => (
                <span
                  key={h}
                  className="pointer-events-none absolute h-px bg-borda"
                  style={{
                    top: i * 60 * PX_POR_MIN,
                    left: COLUNA_HORAS,
                    right: 0,
                  }}
                />
              ))}

              <div
                className="pointer-events-none absolute flex items-center border-y border-borda bg-superficie-apagada/80"
                style={{
                  top: (13 * 60 - INICIO) * PX_POR_MIN,
                  height: 60 * PX_POR_MIN,
                  left: COLUNA_HORAS,
                  right: 0,
                }}
              >
                <span className="num px-3 text-xs text-texto-apagado">
                  almoço 13h às 14h
                </span>
              </div>

              <div className="relative">
                {HORAS.map((h, i) => (
                  <span
                    key={h}
                    className="num absolute right-2 -translate-y-1/2 text-xs text-texto-apagado"
                    style={{ top: i * 60 * PX_POR_MIN }}
                  >
                    {String(h).padStart(2, "0")}h
                  </span>
                ))}
              </div>

              {BARBEIROS.map((b) => (
                <div key={b.id} className="relative">
                  {agendamentos
                    .filter((a) => a.barbeiro === b.id)
                    .map((a) => (
                      <Bloco key={`${a.barbeiro}-${a.hora}`} agendamento={a} />
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Bloco({ agendamento }: { agendamento: Agendamento }) {
  const topo = (minutos(agendamento.hora) - INICIO) * PX_POR_MIN;
  const altura = Math.max(
    ALTURA_MINIMA,
    agendamento.duracaoMin * PX_POR_MIN - 4,
  );
  const compacto = altura < COMPACTO_ATE;

  return (
    <article
      className="absolute left-1 right-1 flex overflow-hidden rounded-bloco border border-borda-forte bg-superficie-ativa px-2"
      style={{ top: topo, height: altura }}
    >
      {compacto ? (
        <div className="flex w-full items-center gap-1.5">
          <span className="num shrink-0 font-titulo text-xs font-bold text-texto">
            {agendamento.hora}
          </span>
          <span className="truncate text-xs text-texto-suave">
            {agendamento.servico}
          </span>
          {agendamento.assinante ? <Ponto /> : null}
        </div>
      ) : (
        <div className="flex w-full flex-col justify-center gap-0.5 py-1">
          <div className="flex items-center gap-1.5">
            <span className="num shrink-0 font-titulo text-xs font-bold text-texto">
              {agendamento.hora}
            </span>
            <span className="truncate font-titulo text-xs font-semibold text-texto">
              {agendamento.servico}
            </span>
            {agendamento.assinante ? <Ponto /> : null}
          </div>
          <span className="truncate text-xs text-texto-suave">
            {agendamento.cliente}
          </span>
        </div>
      )}
    </article>
  );
}

function Ponto() {
  return (
    <span
      className="ml-auto h-2 w-2 shrink-0 rounded-pill bg-acao"
      title="assinante do clube"
      aria-label="assinante do clube"
    />
  );
}

function Vazio({
  icone,
  titulo,
  texto,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-borda bg-superficie-ativa px-4 py-12 text-center">
      <span className="text-texto-apagado">{icone}</span>
      <span className="font-titulo text-base font-semibold">{titulo}</span>
      <span className="max-w-sm text-sm text-texto-suave">{texto}</span>
    </div>
  );
}
