"use client";

import { useState, useTransition } from "react";
import { CreditCard, ExternalLink, TriangleAlert } from "lucide-react";

import { pagarComCartao } from "@/app/meu-agendamento/[token]/acoes";

/**
 * Cartão, embaixo do pix.
 *
 * O pix daqui de cima é BR Code direto na chave do Johny: cai na hora e sem
 * taxa, e por isso continua sendo o primeiro da tela. O cartão existe para
 * quem não tem o dinheiro agora — e antes disso simplesmente não existia.
 *
 * Dois caminhos, e o componente aceita os dois:
 *
 *   token  — cobrança criada na hora pela Stripe, com o valor deste horário.
 *            Confirma sozinho na agenda quando o cliente termina de pagar.
 *   url    — link fixo colado no painel, sem integração. Confirmação na mão.
 *
 * Se nenhum dos dois vier, o componente não aparece: o pix acima continua
 * inteiro, e nenhum caminho novo pode deixar alguém sem conseguir pagar.
 */
export function OutrasFormas({
  token,
  url,
  valor,
  whatsapp,
}: {
  token?: string | null;
  url?: string | null;
  valor: string;
  whatsapp?: string | null;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [indo, comecar] = useTransition();

  if (!token && !url) return null;

  const abrir = () =>
    comecar(async () => {
      setErro(null);
      const r = await pagarComCartao(token!);
      if (r.erro || !r.url) {
        setErro(r.erro ?? "Não consegui abrir o cartão agora.");
        return;
      }
      window.location.href = r.url;
    });

  return (
    <div className="flex flex-col gap-3 rounded-card border border-borda bg-superficie p-4">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 shrink-0 text-texto-suave" strokeWidth={2} />
        <span className="font-titulo text-sm font-semibold text-texto">
          Prefere cartão?
        </span>
      </div>

      {token ? (
        <button
          type="button"
          onClick={abrir}
          disabled={indo}
          className="inline-flex min-h-toque items-center justify-center gap-2 rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao hover:text-acao disabled:opacity-60"
        >
          {indo ? "Abrindo..." : `Pagar ${valor} no cartão`}
          <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={2} />
        </button>
      ) : (
        <a
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-toque items-center justify-center gap-2 rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao hover:text-acao"
        >
          Cartão, débito ou pix · {valor}
          <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={2} />
        </a>
      )}

      {erro ? (
        <p className="flex items-start gap-2 text-xs text-alerta">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          {erro}
        </p>
      ) : null}

      <p className="text-xs text-texto-suave">
        {token
          ? "Abre a página segura da Stripe. Assim que o pagamento passa, seu horário confirma sozinho — não precisa avisar ninguém."
          : "Abre a página do PagBank, onde dá para parcelar no crédito, pagar no débito ou no pix. O barbeiro confirma quando o pagamento cair."}
      </p>

      <p className="text-xs text-texto-apagado">
        Se a página não abrir, use o pix aqui de cima
        {whatsapp ? ` ou chame no ${whatsapp}` : ""}.
      </p>
    </div>
  );
}
