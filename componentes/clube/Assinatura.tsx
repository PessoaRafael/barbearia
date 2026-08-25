"use client";

import { useState, useTransition } from "react";
import { CreditCard, RotateCcw, TriangleAlert } from "lucide-react";

import {
  cancelarRenovacao,
  paginaDoCartao,
  voltarAtras,
} from "@/app/clube/acoes";

/**
 * Cartão e cancelamento, para quem assina no automático.
 *
 * Cancelar fica aqui e não na página da Stripe: mandar alguém para fora do
 * site para desistir parece que ele saiu da barbearia, e é justamente a hora
 * em que a gente quer estar por perto.
 *
 * Trocar cartão, ao contrário, tem que ser lá — número de cartão não passa
 * pelo nosso servidor, e não queremos que passe.
 */
export function Assinatura({
  ate,
  cancelando,
}: {
  /** Até quando o período pago vale. */
  ate: string | null;
  /** Ele já pediu para não renovar? */
  cancelando: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, comecar] = useTransition();

  const dia = ate
    ? new Date(`${ate}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
      })
    : null;

  if (cancelando) {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-alerta/40 bg-superficie px-4 py-4">
        <span className="flex items-start gap-2 text-sm text-texto">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-alerta" strokeWidth={2} />
          <span>
            Sua assinatura <b>não vai renovar</b>
            {dia ? ` e vale até ${dia}` : ""}. Até lá está tudo normal: pode
            marcar e cortar como sempre.
          </span>
        </span>

        {erro ? <span className="text-xs text-alerta">{erro}</span> : null}

        <button
          type="button"
          disabled={rodando}
          onClick={() =>
            comecar(async () => {
              const r = await voltarAtras();
              if (r.erro) setErro(r.erro);
            })
          }
          className="inline-flex min-h-toque items-center justify-center gap-2 self-start rounded-pill border border-clube/60 px-5 font-titulo text-sm font-semibold text-clube transition-colors hover:bg-clube/10 disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2} />
          {rodando ? "Voltando..." : "Quero continuar no clube"}
        </button>
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-alerta/50 bg-superficie px-4 py-4">
        <span className="text-sm text-texto">
          Cancelar a renovação?
          {dia ? (
            <>
              {" "}
              Você <b>continua no clube até {dia}</b> — nada muda até lá. Depois
              disso volta a pagar por corte, e pode assinar de novo quando
              quiser.
            </>
          ) : null}
        </span>

        {erro ? <span className="text-xs text-alerta">{erro}</span> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={rodando}
            onClick={() =>
              comecar(async () => {
                const r = await cancelarRenovacao();
                if (r.erro) setErro(r.erro);
                else setConfirmando(false);
              })
            }
            className="inline-flex min-h-toque items-center rounded-pill border border-alerta/60 px-4 font-titulo text-sm font-semibold text-alerta transition-colors hover:bg-alerta/10 disabled:opacity-60"
          >
            {rodando ? "Cancelando..." : "Sim, cancelar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="inline-flex min-h-toque items-center rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto"
          >
            Deixa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-borda bg-superficie px-4 py-3">
      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-texto-suave">
        <CreditCard className="h-4 w-4 shrink-0 text-clube" strokeWidth={2} />
        <span>
          Cobrança automática no cartão
          {dia ? `, renova em ${dia}` : ""}.
        </span>
      </span>

      {erro ? (
        <span className="w-full text-xs text-alerta">{erro}</span>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={rodando}
          onClick={() =>
            comecar(async () => {
              const r = await paginaDoCartao();
              if (r.erro || !r.url) setErro(r.erro ?? "Não consegui abrir.");
              else window.location.href = r.url;
            })
          }
          className="font-titulo text-xs font-semibold text-texto-suave underline underline-offset-4 hover:text-texto"
        >
          Trocar cartão
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="font-titulo text-xs font-semibold text-texto-apagado underline underline-offset-4 hover:text-alerta"
        >
          Cancelar assinatura
        </button>
      </div>
    </div>
  );
}
