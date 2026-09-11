"use client";

import { Monitor } from "lucide-react";

import { BotaoCopiar } from "@/componentes/BotaoCopiar";

/**
 * O endereço do mural da bancada, para o Johny abrir no tablet.
 *
 * Fica em Ajustes e não na barra de abas porque não é uma tela de trabalho: é
 * um endereço que ele copia uma vez, abre no tablet e nunca mais mexe.
 *
 * O link carrega o token, então dá acesso ao mural e a nada além dele — é por
 * isso que pode ficar num aparelho em cima do balcão.
 */
export function Mural({ url }: { url: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-grande border border-borda bg-superficie p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill border border-borda-forte text-texto-suave">
          <Monitor className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg">Mural da bancada</h2>
          <p className="text-sm text-texto-suave">
            Uma coluna por barbeiro com os horários do dia, e nada mais. Abre
            sem login e se atualiza sozinho a cada minuto.
          </p>
        </div>
      </div>

      <p className="break-all rounded-card border border-borda bg-superficie-ativa px-4 py-3 text-xs text-texto-suave">
        {url}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <BotaoCopiar valor={url} rotulo="Copiar endereço" destaque />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-toque items-center justify-center rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
        >
          Abrir para ver
        </a>
      </div>

      <p className="text-xs text-texto-apagado">
        Não mostra preço, caixa nem telefone de cliente — pode ficar à vista de
        quem espera. No tablet, deixe essa página aberta e ligue para não
        apagar a tela.
      </p>
    </section>
  );
}
