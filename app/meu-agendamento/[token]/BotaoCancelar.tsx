"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";

import { cancelar } from "./acoes";

/** Cancelar é irreversível: pede confirmação antes de soltar a cadeira. */
export function BotaoCancelar({ token }: { token: string }) {
  const [estado, acao, enviando] = useActionState(cancelar, null);
  const [confirmando, setConfirmando] = useState(false);

  if (estado?.ok) {
    return (
      <p className="rounded-card border border-borda bg-superficie px-4 py-3 text-sm text-texto-suave">
        Cancelado. O horário voltou para a agenda.
      </p>
    );
  }

  if (!confirmando) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="inline-flex min-h-toque items-center justify-center rounded-pill border border-alerta/60 px-5 font-titulo text-sm font-semibold text-alerta transition-colors hover:bg-alerta/10"
        >
          Cancelar meu horário
        </button>
        {estado?.erro ? (
          <p role="alert" className="text-sm text-alerta">
            {estado.erro}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      action={acao}
      className="flex flex-col gap-3 rounded-card border border-alerta/50 bg-superficie p-4"
    >
      <input type="hidden" name="token" value={token} />
      <p className="flex items-start gap-2 text-sm text-alerta">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
        Cancelar solta a cadeira na hora. Se usou crédito do clube, ele volta
        para o seu ciclo.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex min-h-toque items-center justify-center rounded-pill border border-alerta/60 px-5 font-titulo text-sm font-semibold text-alerta transition-colors hover:bg-alerta/10"
        >
          {enviando ? "Cancelando..." : "Cancelar mesmo assim"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="inline-flex min-h-toque items-center justify-center rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto"
        >
          Deixa quieto
        </button>
      </div>
    </form>
  );
}
