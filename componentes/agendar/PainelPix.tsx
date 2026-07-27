"use client";

import { Clock } from "lucide-react";

import { PIX } from "@/painel";
import { BotaoCopiar } from "@/componentes/BotaoCopiar";
import { LADO_QR, matrizQr } from "@/lib/qr";

const MATRIZ = matrizQr(PIX.chave);

export function PainelPix({ valor }: { valor: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-borda bg-superficie-ativa p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="mx-auto shrink-0 rounded-bloco bg-texto p-2.5 sm:mx-0">
          <svg
            viewBox={`0 0 ${LADO_QR} ${LADO_QR}`}
            className="h-[136px] w-[136px]"
            role="img"
            aria-label="QR code do pix da Johny Barbearia"
          >
            {MATRIZ.map((linha, l) =>
              linha.map((aceso, c) =>
                aceso ? (
                  <rect
                    key={`${l}-${c}`}
                    x={c}
                    y={l}
                    width={1}
                    height={1}
                    fill="#0B0B0B"
                  />
                ) : null,
              ),
            )}
          </svg>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-texto-apagado">
              Chave pix
            </span>
            <span className="break-all font-titulo text-sm font-semibold text-texto">
              {PIX.chave}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-texto-apagado">
              Valor
            </span>
            <span className="num font-titulo text-xl font-bold text-acao">
              {valor}
            </span>
          </div>
          <BotaoCopiar valor={PIX.chave} rotulo="Copiar chave" className="w-full sm:w-auto" />
        </div>
      </div>

      <p className="flex items-start gap-2 border-t border-borda pt-3 text-xs text-texto-suave">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-alerta" strokeWidth={2} />
        <span>
          A reserva vale {PIX.reservaMinutos} minutos. O barbeiro confirma o
          horário assim que o pix cair — não precisa avisar por aqui.
        </span>
      </p>
    </div>
  );
}
