"use client";

import { useState } from "react";
import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Crown,
  Lock,
  Minus,
  MoonStar,
  Plus,
  UserPlus,
  X,
} from "lucide-react";

import {
  BARBEIROS,
  EXPEDIENTE,
  TODOS_HORARIOS,
  type BarbeiroId,
} from "@/agenda";
import { AGENDA_POR_DIA, type Agendamento } from "@/painel";
import { SERVICOS, servicoPorId } from "@/servicos";
import { minutos } from "@/lib/formato";
import { horarioLivre, slotsOcupados } from "@/lib/disponibilidade";
import {
  periodoDa,
  proximaAbertura,
  rotuloDoDia,
  semanaDe,
} from "@/lib/semana";
import {
  extrasDoDia,
  useOperacao,
  type Marcacao,
} from "@/lib/operacao";

const PX_POR_MIN = 1.5;
const INICIO = EXPEDIENTE.abre * 60;
const FIM = EXPEDIENTE.fecha * 60;
const ALTURA = (FIM - INICIO) * PX_POR_MIN;
const ALTURA_MINIMA = 34;
const COMPACTO_ATE = 52;
const COLUNA_HORAS = 52;
const ALTURA_SLOT = 30 * PX_POR_MIN - 4;

const HORAS = Array.from(
  { length: EXPEDIENTE.fecha - EXPEDIENTE.abre + 1 },
  (_, i) => EXPEDIENTE.abre + i,
);

/** Só os dois primeiros dias e o domingo entram na régua do painel. */
const IDS_PAINEL = ["d0", "d1", "d6"];

/**
 * Uma coluna por barbeiro só a partir de 640px. Abaixo disso três colunas
 * viram 107px cada e todo bloco trunca, então o celular mostra um barbeiro
 * por vez. O repeat(3) espelha BARBEIROS — classe precisa ser literal.
 */
const GRADE =
  "grid-cols-[52px_minmax(0,1fr)] sm:grid-cols-[52px_repeat(3,minmax(0,1fr))]";

function deMarcacao(m: Marcacao): Agendamento {
  const servico = servicoPorId(m.servicoId);
  return {
    barbeiro: m.barbeiro,
    hora: m.hora,
    duracaoMin: servico?.duracaoMin ?? 30,
    cliente: m.cliente,
    servico: servico?.nome ?? "Serviço",
    assinante: m.clube,
  };
}

export function Agenda() {
  const {
    operacao,
    semanaAberta,
    virarSemana,
    tetoDo,
    marcacoesDo,
    clubeUsado,
    clubeCheio,
    estaBloqueado,
    alternarBloqueio,
    ajustarTeto,
    marcar,
  } = useOperacao();

  const [diaId, setDiaId] = useState("d0");
  const [foco, setFoco] = useState<BarbeiroId>(BARBEIROS[0].id);
  const [encaixando, setEncaixando] = useState(false);

  const dias = semanaDe(semanaAberta);
  const diasPainel = dias.filter((d) => IDS_PAINEL.includes(d.id));
  const dia = dias.find((d) => d.id === diaId);
  const fechado = Boolean(dia?.fechado);
  const agendamentos = [
    ...(AGENDA_POR_DIA[diaId] ?? []),
    ...marcacoesDo(diaId).map(deMarcacao),
  ];
  const extras = extrasDoDia(operacao, diaId);

  /** Slots que já têm corte em cima, por barbeiro. */
  function ocupadosDe(barbeiro: BarbeiroId) {
    const usados = new Set<string>();
    for (const a of agendamentos) {
      if (a.barbeiro !== barbeiro) continue;
      for (const slot of slotsOcupados(a.hora, a.duracaoMin)) usados.add(slot);
    }
    return usados;
  }

  return (
    <section className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4 sm:p-5">
      <SemanaAberta
        semana={semanaAberta}
        onVirar={virarSemana}
        marcados={operacao.marcacoes.length}
        bloqueados={operacao.bloqueios.length}
      />

      <VagasDoClube
        semana={semanaAberta}
        diaId={diaId}
        usado={clubeUsado(diaId)}
        teto={tetoDo(diaId)}
        cheio={clubeCheio(diaId)}
        onAjustar={(valor) => ajustarTeto(diaId, valor)}
      />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Agenda do dia</h2>
        <div className="flex gap-2">
          {diasPainel.map((d) => {
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
                {rotuloDoDia(semanaAberta, d.id)}
              </button>
            );
          })}
        </div>
      </header>

      {fechado ? (
        <Vazio
          icone={<MoonStar className="h-5 w-5" strokeWidth={1.75} />}
          titulo="Domingo a casa fecha"
          texto="Nenhum barbeiro na escala e nada marcado."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-texto-apagado">
              Toque num vão vazio para fechar o horário.
            </p>
            <button
              type="button"
              onClick={() => setEncaixando((v) => !v)}
              className={`inline-flex min-h-toque items-center gap-2 rounded-pill border px-4 font-titulo text-sm font-semibold transition-colors ${
                encaixando
                  ? "border-acao text-acao"
                  : "border-borda-forte text-texto hover:border-acao"
              }`}
            >
              {encaixando ? (
                <X className="h-4 w-4" strokeWidth={2} />
              ) : (
                <UserPlus className="h-4 w-4" strokeWidth={2} />
              )}
              {encaixando ? "Fechar" : "Encaixar"}
            </button>
          </div>

          {encaixando ? (
            <Encaixe
              diaId={diaId}
              extras={extras}
              clubeCheio={clubeCheio(diaId)}
              onMarcar={(m) => {
                marcar(m);
                setEncaixando(false);
                setFoco(m.barbeiro);
              }}
            />
          ) : null}

          {agendamentos.length === 0 ? (
            <Vazio
              icone={<CalendarOff className="h-5 w-5" strokeWidth={1.75} />}
              titulo="Nenhum agendamento nesse dia"
              texto="A régua está vazia. Mande o link de agendamento para o grupo."
            />
          ) : null}

          <div className="flex gap-2 sm:hidden">
            {BARBEIROS.map((b) => {
              const ativo = b.id === foco;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setFoco(b.id)}
                  aria-pressed={ativo}
                  className={`inline-flex min-h-toque flex-1 items-center justify-center rounded-pill border px-2 font-titulo text-sm font-semibold transition-colors ${
                    ativo
                      ? "border-acao bg-acao text-acao-sobre"
                      : "border-borda bg-superficie-ativa text-texto-suave"
                  }`}
                >
                  {b.nome}
                </button>
              );
            })}
          </div>

          <div>
            <div className={`grid pb-2 ${GRADE}`}>
              <span />
              {BARBEIROS.map((b) => (
                <div
                  key={b.id}
                  className={`flex-col px-1 sm:flex ${
                    b.id === foco ? "flex" : "hidden"
                  }`}
                >
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

            <div className={`relative grid ${GRADE}`} style={{ height: ALTURA }}>
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

              {BARBEIROS.map((b) => {
                const usados = ocupadosDe(b.id);
                return (
                  <div
                    key={b.id}
                    className={`relative sm:block ${
                      b.id === foco ? "block" : "hidden"
                    }`}
                  >
                    {TODOS_HORARIOS.filter((h) => !usados.has(h)).map((h) => (
                      <SlotVago
                        key={h}
                        hora={h}
                        barbeiro={b.nome}
                        bloqueado={estaBloqueado(diaId, b.id, h)}
                        onAlternar={() => alternarBloqueio(diaId, b.id, h)}
                      />
                    ))}

                    {agendamentos
                      .filter((a) => a.barbeiro === b.id)
                      .map((a) => (
                        <Bloco key={`${a.barbeiro}-${a.hora}`} agendamento={a} />
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * A régua abre uma semana por vez. Virar a semana é o "abrir a atualização de
 * segunda": régua nova, sem bloqueio nem marcação herdada.
 */
function SemanaAberta({
  semana,
  marcados,
  bloqueados,
  onVirar,
}: {
  semana: number;
  marcados: number;
  bloqueados: number;
  onVirar: (passo: number) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const aPerder = marcados + bloqueados;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-borda bg-superficie-ativa p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs uppercase tracking-wide text-texto-apagado">
            Semana aberta para agendar
          </span>
          <span className="num font-titulo text-lg font-semibold">
            {periodoDa(semana)}
          </span>
        </div>

        <div className="flex gap-2">
          {semana > 0 ? (
            <button
              type="button"
              onClick={() => onVirar(-1)}
              className="inline-flex min-h-toque items-center gap-1.5 rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
              Voltar
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (aPerder > 0 ? setConfirmando(true) : onVirar(1))}
            className="inline-flex min-h-toque items-center gap-1.5 rounded-pill bg-acao px-4 font-titulo text-sm font-semibold text-acao-sobre transition-colors hover:bg-acao-hover"
          >
            Abrir a próxima
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <p className="text-xs text-texto-suave">
        O cliente só consegue marcar dentro dessa semana — ninguém pega o mês
        inteiro. A próxima entra {proximaAbertura(semana)}.
      </p>

      {confirmando ? (
        <div className="flex flex-col gap-3 rounded-bloco border border-alerta/50 bg-superficie p-3">
          <p className="text-xs text-alerta">
            Abrir a próxima semana zera a régua: {marcados} marcações e{" "}
            {bloqueados} horários fechados dessa semana saem da tela.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onVirar(1);
                setConfirmando(false);
              }}
              className="inline-flex min-h-toque items-center rounded-pill bg-acao px-4 font-titulo text-sm font-semibold text-acao-sobre transition-colors hover:bg-acao-hover"
            >
              Abrir mesmo assim
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="inline-flex min-h-toque items-center rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto"
            >
              Deixa quieto
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VagasDoClube({
  semana,
  diaId,
  usado,
  teto,
  cheio,
  onAjustar,
}: {
  semana: number;
  diaId: string;
  usado: number;
  teto: number;
  cheio: boolean;
  onAjustar: (valor: number) => void;
}) {
  const restam = Math.max(0, teto - usado);
  const porcentagem = teto === 0 ? 100 : Math.min(100, (usado / teto) * 100);

  return (
    <div
      className={`flex flex-col gap-3 rounded-card border p-4 ${
        cheio ? "border-alerta/50" : "border-borda"
      } bg-superficie-ativa`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Crown
            className={`h-4 w-4 shrink-0 ${cheio ? "text-alerta" : "text-clube"}`}
            strokeWidth={2}
          />
          <span className="font-titulo text-sm font-semibold">
            Vagas do clube {rotuloDoDia(semana, diaId)}
          </span>
        </span>

        <div className="flex items-center gap-2">
          <span className="num font-titulo text-2xl font-bold text-texto">
            {usado} de {teto}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onAjustar(teto - 1)}
              aria-label="Uma vaga do clube a menos"
              className="grid h-toque w-toque place-items-center rounded-pill border border-borda-forte text-texto transition-colors hover:border-acao"
            >
              <Minus className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => onAjustar(teto + 1)}
              aria-label="Uma vaga do clube a mais"
              className="grid h-toque w-toque place-items-center rounded-pill border border-borda-forte text-texto transition-colors hover:border-acao"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-pill bg-superficie-apagada">
        <div
          className={`h-full rounded-pill transition-all ${
            cheio ? "bg-alerta" : "bg-clube"
          }`}
          style={{ width: `${porcentagem}%` }}
        />
      </div>

      <p className={`text-xs ${cheio ? "text-alerta" : "text-texto-suave"}`}>
        {cheio
          ? "Clube fechado nesse dia. Assinante que entrar no site paga avulso."
          : `Sobram ${restam} cadeiras para o clube. O resto do dia fica para o avulso.`}
      </p>
    </div>
  );
}

function Encaixe({
  diaId,
  extras,
  clubeCheio,
  onMarcar,
}: {
  diaId: string;
  extras: Set<string>;
  clubeCheio: boolean;
  onMarcar: (marcacao: Marcacao) => void;
}) {
  const [cliente, setCliente] = useState("");
  const [servicoId, setServicoId] = useState(SERVICOS[0].id);
  const [barbeiro, setBarbeiro] = useState<BarbeiroId>(BARBEIROS[0].id);
  const [hora, setHora] = useState("");
  const [clube, setClube] = useState(false);

  const servico = servicoPorId(servicoId);
  const cobreClube = Boolean(servico && servico.clubeAbate > 0) && !clubeCheio;
  const livres = TODOS_HORARIOS.filter((h) =>
    horarioLivre(barbeiro, diaId, h, servico?.duracaoMin ?? 30, extras),
  );
  const pronto = cliente.trim().length > 0 && hora.length > 0;

  const campo =
    "min-h-toque w-full rounded-bloco border border-borda bg-superficie px-3 text-sm text-texto";

  return (
    <form
      className="flex flex-col gap-3 rounded-card border border-borda-forte bg-superficie-ativa p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pronto) return;
        onMarcar({
          id: `${diaId}-${barbeiro}-${hora}`,
          diaId,
          barbeiro,
          hora,
          servicoId,
          cliente: cliente.trim(),
          clube: clube && cobreClube,
          origem: "painel",
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-texto-suave">Cliente</span>
          <input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Nome de quem senta"
            className={campo}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-texto-suave">Serviço</span>
          <select
            value={servicoId}
            onChange={(e) => {
              setServicoId(e.target.value);
              setHora("");
            }}
            className={campo}
          >
            {SERVICOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} · {s.duracaoLabel}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-texto-suave">Barbeiro</span>
          <select
            value={barbeiro}
            onChange={(e) => {
              setBarbeiro(e.target.value as BarbeiroId);
              setHora("");
            }}
            className={campo}
          >
            {BARBEIROS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-texto-suave">Horário</span>
          <select
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className={campo}
          >
            <option value="">
              {livres.length === 0 ? "Sem horário livre" : "Escolher"}
            </option>
            {livres.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={clube && cobreClube}
          disabled={!cobreClube}
          onChange={(e) => setClube(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-[#F5CE0A]"
        />
        <span
          className={`text-sm ${cobreClube ? "text-texto" : "text-texto-apagado"}`}
        >
          {clubeCheio
            ? "Vagas do clube esgotadas nesse dia"
            : servico && servico.clubeAbate > 0
              ? "Gasta 1 corte do clube"
              : "Esse serviço não entra no clube"}
        </span>
      </label>

      <button
        type="submit"
        disabled={!pronto}
        className={`inline-flex min-h-toque items-center justify-center rounded-pill px-5 font-titulo text-sm font-bold transition-colors ${
          pronto
            ? "bg-acao text-acao-sobre hover:bg-acao-hover"
            : "cursor-not-allowed border border-borda bg-superficie-apagada text-texto-apagado"
        }`}
      >
        Encaixar na agenda
      </button>
    </form>
  );
}

function SlotVago({
  hora,
  barbeiro,
  bloqueado,
  onAlternar,
}: {
  hora: string;
  barbeiro: string;
  bloqueado: boolean;
  onAlternar: () => void;
}) {
  const topo = (minutos(hora) - INICIO) * PX_POR_MIN;

  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-pressed={bloqueado}
      aria-label={`${bloqueado ? "Liberar" : "Fechar"} ${hora} de ${barbeiro}`}
      className={`absolute left-1 right-1 flex items-center gap-1 overflow-hidden rounded-bloco border px-2 transition-colors ${
        bloqueado
          ? "border-borda-forte bg-superficie-apagada text-texto-apagado"
          : "border-transparent text-transparent hover:border-borda-forte hover:bg-superficie-ativa hover:text-texto-apagado"
      }`}
      style={{ top: topo, height: ALTURA_SLOT }}
    >
      <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span className="truncate text-xs">
        {bloqueado ? "fechado" : "fechar"}
      </span>
    </button>
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
