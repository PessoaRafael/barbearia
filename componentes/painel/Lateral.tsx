"use client";

import { useState } from "react";
import { CheckCheck, Timer, UserMinus } from "lucide-react";

import {
  CLIENTES,
  MENSALIDADES_VENCIDAS,
  METRICAS,
  PIX_PENDENTES,
} from "@/painel";
import type { LateralLista } from "@/lib/abas";
import { moeda, numero } from "@/lib/formato";

function Card({
  titulo,
  children,
}: {
  titulo?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-grande border border-borda bg-superficie p-4">
      {titulo ? (
        <h3 className="text-xs uppercase tracking-wide text-texto-apagado">
          {titulo}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="rounded-card border border-borda bg-superficie-ativa px-3 py-6 text-center text-sm text-texto-suave">
      {texto}
    </p>
  );
}

export function LateralAgenda() {
  const [pendentes, setPendentes] = useState(PIX_PENDENTES);
  const clubeMes = METRICAS.mes.clube;
  const avulsoMes = METRICAS.mes.avulso;
  const totalMes = clubeMes + avulsoMes;
  const parteClube = Math.round((clubeMes / totalMes) * 100);
  const sumidos = CLIENTES.filter((c) => c.sumido);

  return (
    <div className="flex flex-col gap-4">
      <Card titulo="Pix para conferir">
        {pendentes.length === 0 ? (
          <Vazio texto="Nenhum pix pendente. Tudo conferido." />
        ) : (
          <ul className="flex flex-col gap-2">
            {pendentes.map((pix) => (
              <li
                key={pix.cliente}
                className="flex flex-col gap-2 rounded-card border border-borda bg-superficie-ativa p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-titulo text-sm font-semibold">
                      {pix.cliente}
                    </span>
                    <span className="num truncate text-xs text-texto-suave">
                      {pix.reserva}
                    </span>
                  </div>
                  <span className="num shrink-0 font-titulo text-base font-bold text-acao">
                    {moeda(pix.valor)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="num flex items-center gap-1.5 text-xs text-alerta">
                    <Timer className="h-3.5 w-3.5" strokeWidth={2} />
                    expira em {pix.expiraEm}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPendentes((lista) =>
                        lista.filter((p) => p.cliente !== pix.cliente),
                      )
                    }
                    className="inline-flex min-h-toque shrink-0 items-center gap-2 rounded-pill bg-acao px-4 font-titulo text-sm font-semibold text-acao-sobre transition-colors hover:bg-acao-hover"
                  >
                    <CheckCheck className="h-4 w-4" strokeWidth={2.5} />
                    Recebi
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card titulo="Faturamento do mês">
        <span className="num font-titulo text-4xl font-bold text-texto">
          {moeda(METRICAS.mes.faturamento)}
        </span>

        <div className="flex h-2 w-full overflow-hidden rounded-pill bg-superficie-apagada">
          <span className="h-full bg-clube" style={{ width: `${parteClube}%` }} />
          <span className="h-full flex-1 bg-borda-forte" />
        </div>

        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="num flex items-center gap-2 text-clube">
            <span className="h-2 w-2 rounded-pill bg-clube" />
            clube {moeda(clubeMes)}
          </span>
          <span className="num flex items-center gap-2 text-texto-suave">
            <span className="h-2 w-2 rounded-pill bg-borda-forte" />
            avulso {moeda(avulsoMes)}
          </span>
        </div>

        <ul className="flex flex-col gap-2 border-t border-borda pt-3">
          {[
            { rotulo: "Ocupação das cadeiras", valor: METRICAS.mes.ocupacao },
            { rotulo: "Faltas no mês", valor: numero(METRICAS.mes.faltas) },
            { rotulo: "Sumidos há 30 dias", valor: numero(METRICAS.mes.sumidos) },
          ].map((item) => (
            <li
              key={item.rotulo}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="text-sm text-texto-suave">{item.rotulo}</span>
              <span className="num font-titulo text-base font-semibold text-texto">
                {item.valor}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card titulo="Mensalidades vencidas">
        {MENSALIDADES_VENCIDAS.length === 0 ? (
          <Vazio texto="Ninguém devendo neste mês." />
        ) : (
          <ul className="flex flex-col gap-2">
            {MENSALIDADES_VENCIDAS.map((m) => (
              <li
                key={m.cliente}
                className="flex items-center gap-3 rounded-card border border-alerta/40 bg-superficie-ativa px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-titulo text-sm font-semibold">
                    {m.cliente}
                  </span>
                  <span className="num truncate text-xs text-alerta">
                    {m.atraso}
                  </span>
                </div>
                <span className="num shrink-0 font-titulo text-sm font-bold text-texto">
                  {moeda(m.valor)}
                </span>
                <button
                  type="button"
                  className="inline-flex min-h-toque shrink-0 items-center rounded-pill border border-alerta/60 px-3 font-titulo text-sm font-semibold text-alerta transition-colors hover:bg-alerta/10"
                >
                  Cobrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card titulo="Sumidos há 30 dias">
        {sumidos.length === 0 ? (
          <Vazio texto="Ninguém sumiu. A régua está cheia." />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {sumidos.map((c) => (
                <li
                  key={c.nome}
                  className="flex items-center gap-3 rounded-card border border-borda bg-superficie-ativa px-3 py-2.5"
                >
                  <UserMinus
                    className="h-4 w-4 shrink-0 text-texto-apagado"
                    strokeWidth={2}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-titulo text-sm font-semibold">
                      {c.nome}
                    </span>
                    <span className="num truncate text-xs text-texto-suave">
                      {c.ultimo}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="inline-flex min-h-toque items-center justify-center rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
            >
              Chamar os {numero(METRICAS.mes.sumidos)}
            </button>
          </>
        )}
      </Card>
    </div>
  );
}

export function LateralGenerica({ dados }: { dados: LateralLista }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <span className="num font-titulo text-4xl font-bold text-texto">
          {dados.numero.valor}
        </span>
        <span className="text-sm text-texto-suave">{dados.numero.rotulo}</span>
      </Card>

      <Card titulo="No mês">
        <ul className="flex flex-col gap-2">
          {dados.metricas.map((m) => (
            <li key={m.rotulo} className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-texto-suave">{m.rotulo}</span>
              <span className="num font-titulo text-base font-semibold text-texto">
                {m.valor}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex flex-col gap-1">
          <span
            className={`font-titulo text-base font-semibold ${
              dados.acao.tom === "alerta" ? "text-alerta" : "text-texto"
            }`}
          >
            {dados.acao.titulo}
          </span>
          <span className="text-sm text-texto-suave">{dados.acao.texto}</span>
        </div>
        <button
          type="button"
          className={`inline-flex min-h-toque items-center justify-center rounded-pill px-4 font-titulo text-sm font-semibold transition-colors ${
            dados.acao.tom === "alerta"
              ? "border border-alerta/60 text-alerta hover:bg-alerta/10"
              : "bg-acao text-acao-sobre hover:bg-acao-hover"
          }`}
        >
          {dados.acao.botao}
        </button>
      </Card>
    </div>
  );
}
