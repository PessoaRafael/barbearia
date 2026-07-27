"use client";

import { CalendarX2, MoonStar } from "lucide-react";

import { ALMOCO, HORARIOS_MANHA, HORARIOS_TARDE } from "@/agenda";
import type { Servico } from "@/servicos";
import {
  estaFechado,
  horarioLivre,
  livresPorTurno,
  type Escolha,
} from "@/lib/disponibilidade";
import { periodoDa, proximaAbertura, semanaDe } from "@/lib/semana";

export function PassoHorario({
  servico,
  escolha,
  diaId,
  hora,
  extras,
  semana,
  onDia,
  onHora,
}: {
  servico: Servico;
  escolha: Escolha;
  diaId: string;
  hora: string | null;
  extras?: Set<string>;
  semana: number;
  onDia: (id: string) => void;
  onHora: (h: string) => void;
}) {
  const fechado = estaFechado(diaId);
  const livres = livresPorTurno(escolha, diaId, servico.duracaoMin, extras);
  const total = livres.manha + livres.tarde;
  const dias = semanaDe(semana);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="num text-xs text-texto-suave">
            Semana aberta · {periodoDa(semana)}
          </span>
          <span className="text-xs text-texto-apagado">domingo fechado</span>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {dias.map((dia) => {
            const ativo = dia.id === diaId;
            return (
              <button
                key={dia.id}
                type="button"
                disabled={dia.fechado}
                onClick={() => onDia(dia.id)}
                aria-pressed={ativo}
                aria-label={`${dia.diaSemana} ${dia.numero} de ${dia.mes}${dia.fechado ? ", fechado" : ""}`}
                className={`flex min-h-toque flex-col items-center justify-center gap-1 rounded-bloco border px-0.5 py-2 transition-colors ${
                  ativo
                    ? "border-acao bg-acao text-acao-sobre"
                    : dia.fechado
                      ? "cursor-not-allowed border-borda bg-superficie-apagada text-texto-apagado"
                      : "border-borda bg-superficie-ativa text-texto hover:border-borda-forte"
                }`}
              >
                <span className="text-xs leading-none opacity-80">
                  {dia.diaSemana}
                </span>
                <span className="num font-titulo text-lg font-bold leading-none">
                  {dia.numero}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-texto-apagado">
          Só essa semana está aberta. A próxima entra {proximaAbertura(semana)}.
        </p>
      </div>

      {fechado ? (
        <Vazio
          icone={<MoonStar className="h-5 w-5" strokeWidth={1.75} />}
          titulo="Domingo a casa fecha"
          texto="Escolha outro dia na régua acima."
        />
      ) : total === 0 ? (
        <Vazio
          icone={<CalendarX2 className="h-5 w-5" strokeWidth={1.75} />}
          titulo="Nenhum horário livre nesse dia"
          texto={`${servico.nome} precisa de ${servico.duracaoLabel} seguidos. Tente outro dia ou outro barbeiro.`}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Turno
            rotulo="manhã"
            livres={livres.manha}
            horarios={HORARIOS_MANHA}
            servico={servico}
            escolha={escolha}
            diaId={diaId}
            hora={hora}
            extras={extras}
            onHora={onHora}
          />

          <div className="flex items-center gap-3" role="separator">
            <span className="h-px flex-1 bg-borda" />
            <span className="num text-xs text-texto-apagado">
              {ALMOCO.label}
            </span>
            <span className="h-px flex-1 bg-borda" />
          </div>

          <Turno
            rotulo="tarde"
            livres={livres.tarde}
            horarios={HORARIOS_TARDE}
            servico={servico}
            escolha={escolha}
            diaId={diaId}
            hora={hora}
            extras={extras}
            onHora={onHora}
          />
        </div>
      )}
    </div>
  );
}

function Turno({
  rotulo,
  livres,
  horarios,
  servico,
  escolha,
  diaId,
  hora,
  extras,
  onHora,
}: {
  rotulo: string;
  livres: number;
  horarios: string[];
  servico: Servico;
  escolha: Escolha;
  diaId: string;
  hora: string | null;
  extras?: Set<string>;
  onHora: (h: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-texto-medio">{rotulo}</span>
        <span className="num text-xs text-texto-suave">
          {livres === 0 ? "sem horário" : `${livres} livres`}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:[grid-template-columns:repeat(auto-fit,minmax(92px,1fr))]">
        {horarios.map((h) => {
          const livre = horarioLivre(
            escolha,
            diaId,
            h,
            servico.duracaoMin,
            extras,
          );
          const ativo = hora === h;
          return (
            <button
              key={h}
              type="button"
              disabled={!livre}
              onClick={() => onHora(h)}
              aria-pressed={ativo}
              className={`num flex h-[54px] items-center justify-center rounded-bloco border font-titulo text-base font-semibold transition-colors ${
                ativo
                  ? "border-acao border-t-[3px] border-t-acao bg-acao text-acao-sobre"
                  : livre
                    ? "border-borda border-t-[3px] border-t-acao bg-superficie-ativa text-texto hover:border-borda-forte hover:bg-superficie"
                    : "cursor-not-allowed border-borda bg-superficie-apagada text-texto-apagado"
              }`}
            >
              {h}
            </button>
          );
        })}
      </div>
    </div>
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
    <div className="flex flex-col items-center gap-2 rounded-card border border-borda bg-superficie-ativa px-4 py-8 text-center">
      <span className="text-texto-apagado">{icone}</span>
      <span className="font-titulo text-base font-semibold">{titulo}</span>
      <span className="max-w-sm text-sm text-texto-suave">{texto}</span>
    </div>
  );
}
