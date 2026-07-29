"use client";

import { Clock, ShieldCheck } from "lucide-react";

import { BotaoCopiar } from "@/componentes/BotaoCopiar";
import { formatarTelefone } from "@/lib/pix/brcode";

/**
 * Pix copia e cola.
 *
 * Não desenho QR aqui: gerar QR de verdade precisa de uma biblioteca, e um QR
 * decorativo ao lado de um payload real faria alguém escanear e mandar dinheiro
 * para lugar nenhum. O copia e cola é o mesmo payload, aceito por todo banco.
 */
export function PainelPix({
  brcode,
  chave,
  titular,
  valor,
  minutos,
  seguraOHorario = true,
}: {
  brcode: string;
  chave: string;
  titular: string;
  valor: string;
  minutos: number;
  seguraOHorario?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-borda bg-superficie-ativa p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-texto-apagado">
            Valor
          </span>
          <span className="num font-titulo text-2xl font-bold text-acao">
            {valor}
          </span>
        </div>
        <BotaoCopiar
          valor={brcode}
          rotulo="Copiar pix copia e cola"
          destaque
          className="w-full sm:w-auto"
        />
      </div>

      <div className="flex flex-col gap-1 rounded-bloco border border-borda bg-superficie p-3">
        <span className="text-xs uppercase tracking-wide text-texto-apagado">
          Código pix
        </span>
        <span className="num max-h-20 overflow-y-auto break-all text-xs leading-relaxed text-texto-suave">
          {brcode}
        </span>
      </div>

      <dl className="flex flex-col gap-2 border-t border-borda pt-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-texto-suave">Chave</dt>
          <dd className="num font-medium text-texto">
            {formatarTelefone(chave)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-texto-suave">Quem recebe</dt>
          <dd className="truncate text-right font-medium text-texto">
            {titular}
          </dd>
        </div>
      </dl>

      <p className="flex items-start gap-2 text-xs text-texto-suave">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-clube" strokeWidth={2} />
        <span>
          Confira o nome de quem recebe no seu banco antes de enviar.
        </span>
      </p>

      {seguraOHorario ? (
        <p className="flex items-start gap-2 text-xs text-texto-suave">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-alerta" strokeWidth={2} />
          <span>
            A reserva vale {minutos} minutos. O barbeiro confirma o horário
            assim que o pix cair — não precisa avisar por aqui.
          </span>
        </p>
      ) : null}
    </div>
  );
}
