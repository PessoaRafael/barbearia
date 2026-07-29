"use client";

import { Clock, ShieldCheck } from "lucide-react";

import { BotaoCopiar } from "@/componentes/BotaoCopiar";
import { formatarTelefone } from "@/lib/pix/brcode";

/**
 * Pix com as duas saídas: escanear o QR ou copiar o código.
 *
 * O QR é gerado no servidor a partir do mesmo BR Code que está no botão de
 * copiar — nada decorativo. Se ele não vier, a tela mostra só o copia e cola,
 * porque um QR falso faria alguém mandar dinheiro para lugar nenhum.
 */
export function PainelPix({
  brcode,
  qrSvg,
  chave,
  titular,
  valor,
  minutos,
  seguraOHorario = true,
}: {
  brcode: string;
  qrSvg?: string | null;
  chave: string;
  titular: string;
  valor: string;
  minutos: number;
  seguraOHorario?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-borda bg-superficie-ativa p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {qrSvg ? (
          <div className="mx-auto shrink-0 sm:mx-0">
            <div
              className="h-[168px] w-[168px] overflow-hidden rounded-bloco border border-borda bg-texto p-1 [&>svg]:h-full [&>svg]:w-full"
              // Gerado por nós a partir do BR Code, não vem de fora.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              role="img"
              aria-label="QR code do pix"
            />
            <span className="mt-1.5 block text-center text-xs text-texto-apagado">
              aponte a câmera do banco
            </span>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
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
            className="w-full"
          />
          <span className="text-xs text-texto-suave">
            Ou copie o código e cole no seu banco, se preferir.
          </span>
        </div>
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
