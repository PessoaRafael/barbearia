"use client";

import { useState, useTransition } from "react";
import { ExternalLink, TriangleAlert } from "lucide-react";

import { pagarMensalidade } from "@/app/mensalidade/[token]/acoes";

/**
 * O botão que leva para a página da InfinitePay.
 *
 * O link nasce no clique, e não junto com a página: quem só abriu para ver até
 * quando vale não gera cobrança nenhuma.
 */
export function PagarMensalidade({
  token,
  rotulo,
  destaque = true,
}: {
  token: string;
  rotulo: string;
  /** Vencida é o botão principal; adiantar em dia é opção, não pedido. */
  destaque?: boolean;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [indo, comecar] = useTransition();

  const abrir = () =>
    comecar(async () => {
      setErro(null);
      const r = await pagarMensalidade(token);
      if (r.erro || !r.url) {
        setErro(r.erro ?? "Não consegui abrir o pagamento agora.");
        return;
      }
      window.location.href = r.url;
    });

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={abrir}
        disabled={indo}
        className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-pill px-6 font-titulo text-base font-bold transition-colors disabled:opacity-60 ${
          destaque
            ? "bg-acao text-acao-sobre hover:bg-acao-hover"
            : "border border-borda-forte text-texto hover:border-clube hover:text-clube"
        }`}
      >
        {indo ? "Abrindo..." : rotulo}
        <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={2} />
      </button>

      {erro ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-alerta">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          {erro}
        </p>
      ) : null}
    </div>
  );
}
