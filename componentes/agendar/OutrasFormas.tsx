"use client";

import { CreditCard, ExternalLink } from "lucide-react";

/**
 * Cartão, débito e pix pelo link de pagamento do PagBank.
 *
 * Fica embaixo do QR de propósito. O pix daqui de cima é BR Code direto na
 * chave do Johny: cai na hora e sem taxa. O pix que passa por este link entra
 * na conta PagBank e paga tarifa — funciona, mas é o caminho mais caro, então
 * não pode roubar o lugar do outro.
 *
 * Se o link não abrir, o pix continua ali em cima e o WhatsApp também: nenhum
 * caminho novo pode deixar alguém sem conseguir pagar.
 */
export function OutrasFormas({
  url,
  valor,
  whatsapp,
}: {
  url: string;
  valor: string;
  whatsapp?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-borda bg-superficie p-4">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 shrink-0 text-texto-suave" strokeWidth={2} />
        <span className="font-titulo text-sm font-semibold text-texto">
          Outro jeito de pagar
        </span>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-toque items-center justify-center gap-2 rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao hover:text-acao"
      >
        Cartão, débito ou pix · {valor}
        <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={2} />
      </a>

      <p className="text-xs text-texto-suave">
        Abre a página do PagBank, onde dá para parcelar no crédito, pagar no
        débito ou no pix. O horário segue reservado do mesmo jeito, e o barbeiro
        confirma assim que o pagamento cair.
      </p>

      <p className="text-xs text-texto-apagado">
        Se a página não abrir, use o pix aqui de cima
        {whatsapp ? ` ou chame no ${whatsapp}` : ""}.
      </p>
    </div>
  );
}
