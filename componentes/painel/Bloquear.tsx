"use client";

import { useState, useTransition } from "react";
import { Lock, X } from "lucide-react";

import { bloquear } from "@/app/painel/acoes";

/** Fechar um pedaço do dia na correria: almoço estendido, banco, médico. */
export function Bloquear({
  data,
  barbeiroId = null,
}: {
  data: string;
  barbeiroId?: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, comecar] = useTransition();

  const campo =
    "min-h-toque w-full rounded-bloco border border-borda bg-superficie px-3 text-sm text-texto";
  const valido = /^\d{2}:\d{2}$/.test(inicio) && /^\d{2}:\d{2}$/.test(fim) && fim > inicio;

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-toque items-center justify-center gap-2 rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao sm:self-start"
      >
        <Lock className="h-4 w-4" strokeWidth={2} />
        Fechar um horário
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-borda-forte bg-superficie-ativa p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-titulo text-sm font-semibold">
          Fechar horário nesse dia
        </span>
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar"
          className="grid h-toque w-toque place-items-center rounded-pill text-texto-suave hover:text-texto"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-texto-suave">Das</span>
          <input
            type="time"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className={`num ${campo}`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-texto-suave">Até</span>
          <input
            type="time"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className={`num ${campo}`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-texto-suave">Motivo</span>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="opcional"
            className={campo}
          />
        </label>
      </div>

      {erro ? <span className="text-xs text-alerta">{erro}</span> : null}

      <button
        type="button"
        disabled={!valido || rodando}
        onClick={() =>
          comecar(async () => {
            const r = await bloquear({
              data,
              inicio,
              fim,
              motivo: motivo || undefined,
              barbeiroId,
            });
            if (r.erro) setErro(r.erro);
            else {
              setAberto(false);
              setInicio("");
              setFim("");
              setMotivo("");
            }
          })
        }
        className={`inline-flex min-h-toque items-center justify-center rounded-pill px-5 font-titulo text-sm font-bold transition-colors sm:self-start ${
          valido && !rodando
            ? "bg-acao text-acao-sobre hover:bg-acao-hover"
            : "cursor-not-allowed border border-borda bg-superficie-apagada text-texto-apagado"
        }`}
      >
        {rodando ? "Fechando..." : "Fechar esse horário"}
      </button>
    </div>
  );
}
