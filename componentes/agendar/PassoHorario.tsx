"use client";

import { CalendarX2, Loader2, MoonStar } from "lucide-react";

import { periodo, type Dia } from "@/lib/agenda/dias";
import { FilaDeEspera } from "./FilaDeEspera";
import type { Escolha, Livre } from "./tipos";

/** Antes das 13h é manhã; o almoço fica no meio, parando a cadeira. */
const eManha = (hora: string) => Number(hora.slice(0, 2)) < 13;

/** Dia da semana (0-6) no fuso da casa, para casar com os dias do plano. */
const diaDaSemana = (data: string) =>
  new Date(`${data}T12:00:00-03:00`).getUTCDay();

export function PassoHorario({
  dias,
  dia,
  horarios,
  carregando,
  escolha,
  hora,
  servicoId,
  diasDoPlano,
  planoNome,
  onDia,
  onHora,
}: {
  dias: Dia[];
  dia: Dia;
  horarios: Livre[] | null;
  carregando: boolean;
  escolha: Escolha;
  hora: string | null;
  servicoId: string | null;
  /** Dias que o plano do assinante cobre. null enquanto não sabemos quem é. */
  diasDoPlano: number[] | null;
  planoNome: string | null;
  onDia: (data: string) => void;
  onHora: (hora: string) => void;
}) {
  // "Tanto faz" aceita qualquer barbeiro; escolhido, só os dele.
  const doBarbeiro = (horarios ?? []).filter(
    (h) => escolha === null || h.barbeiros.includes(escolha),
  );
  const manha = doBarbeiro.filter((h) => eManha(h.hora));
  const tarde = doBarbeiro.filter((h) => !eManha(h.hora));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="num text-xs text-texto-suave">{periodo(dias)}</span>
          <span className="text-xs text-texto-apagado">domingo fechado</span>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {dias.map((d) => {
            const ativo = d.data === dia.data;
            // Coberto pelo plano: o cliente precisa ver isso ao escolher o
            // dia, não só lá na frente no passo do pagamento.
            const coberto = Boolean(diasDoPlano?.includes(diaDaSemana(d.data)));
            return (
              <button
                key={d.data}
                type="button"
                disabled={d.fechado || (Boolean(diasDoPlano) && !coberto)}
                onClick={() => onDia(d.data)}
                aria-pressed={ativo}
                aria-label={`${d.diaSemana} ${d.numero} de ${d.mes}${d.fechado ? ", fechado" : ""}${
                  diasDoPlano
                    ? coberto
                      ? ", disponível no seu plano"
                      : ", fora dos dias do seu plano"
                    : ""
                }`}
                className={`flex min-h-toque flex-col items-center justify-center gap-1 rounded-bloco border px-0.5 py-2 transition-colors ${
                  ativo
                    ? "border-acao bg-acao text-acao-sobre"
                    : d.fechado || (diasDoPlano && !coberto)
                      ? "cursor-not-allowed border-borda bg-superficie-apagada text-texto-apagado"
                      : "border-borda bg-superficie-ativa text-texto hover:border-borda-forte"
                }`}
              >
                <span className="text-xs leading-none opacity-80">
                  {d.diaSemana}
                </span>
                <span className="num font-titulo text-lg font-bold leading-none">
                  {d.numero}
                </span>
                {/* Um ponto, não um texto: em sete colunas no celular não cabe
                    palavra nenhuma embaixo do número. */}
                {diasDoPlano && !d.fechado && coberto ? (
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-pill ${
                      ativo ? "bg-acao-sobre" : "bg-clube"
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {diasDoPlano ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texto-suave">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-pill bg-clube" />
            seu {planoNome ?? "plano"} atende de segunda a quinta
          </span>
          <span className="text-texto-apagado">
            · sexta e sábado ficam para os avulsos
          </span>
        </p>
      ) : (
        <p className="text-xs text-texto-suave">
          É do clube? O atendimento do plano é de segunda a quinta.
        </p>
      )}

      {dia.fechado ? (
        <Aviso
          icone={<MoonStar className="h-5 w-5" strokeWidth={1.75} />}
          titulo="Domingo a casa fecha"
          texto="Escolha outro dia na régua acima."
        />
      ) : carregando || horarios === null ? (
        <Aviso
          icone={<Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />}
          titulo="Conferindo a agenda"
          texto="Buscando o que está livre de verdade nesse dia."
        />
      ) : doBarbeiro.length === 0 ? (
        <div className="flex flex-col gap-3">
          <Aviso
            icone={<CalendarX2 className="h-5 w-5" strokeWidth={1.75} />}
            titulo="Nenhum horário livre nesse dia"
            texto="Tente outro dia na régua, ou entre na fila e eu te aviso se vagar."
          />
          {servicoId ? (
            <FilaDeEspera
              data={dia.data}
              servicoId={servicoId}
              barbeiroId={escolha}
            />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Turno
            rotulo="manhã"
            lista={manha}
            hora={hora}
            onHora={onHora}
          />

          <div className="flex items-center gap-3" role="separator">
            <span className="h-px flex-1 bg-borda" />
            <span className="num text-xs text-texto-apagado">
              almoço 13h às 14h
            </span>
            <span className="h-px flex-1 bg-borda" />
          </div>

          <Turno
            rotulo="tarde"
            lista={tarde}
            hora={hora}
            onHora={onHora}
          />
        </div>
      )}
    </div>
  );
}

function Turno({
  rotulo,
  lista,
  hora,
  onHora,
}: {
  rotulo: string;
  lista: Livre[];
  hora: string | null;
  onHora: (hora: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-texto-medio">{rotulo}</span>
        <span className="num text-xs text-texto-suave">
          {lista.length === 0 ? "sem horário" : `${lista.length} livres`}
        </span>
      </div>

      {lista.length === 0 ? null : (
        <div className="grid grid-cols-4 gap-2 sm:[grid-template-columns:repeat(auto-fit,minmax(92px,1fr))]">
          {lista.map((h) => {
            const ativo = hora === h.hora;
            return (
              <button
                key={h.hora}
                type="button"
                onClick={() => onHora(h.hora)}
                aria-pressed={ativo}
                className={`num flex h-[54px] items-center justify-center rounded-bloco border font-titulo text-base font-semibold transition-colors ${
                  ativo
                    ? "border-acao border-t-[3px] border-t-acao bg-acao text-acao-sobre"
                    : "border-borda border-t-[3px] border-t-acao bg-superficie-ativa text-texto hover:border-borda-forte hover:bg-superficie"
                }`}
              >
                {h.hora}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Aviso({
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
