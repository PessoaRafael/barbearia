"use client";

import { useState } from "react";
import { Lightbulb, X } from "lucide-react";

/**
 * Uma dica por passo, e só uma na tela.
 *
 * No celular ela flutua logo acima da barra de total, que é onde o polegar já
 * está; no desktop entra na coluna da direita, em fluxo normal, porque lá
 * flutuar só taparia conteúdo.
 *
 * Some no primeiro X e não volta: dica que insiste vira propaganda.
 */
const DICAS: Record<number, string> = {
  1: "Na dúvida, Máquina & tesoura é o mais pedido da casa.",
  2: "Dia cheio? Entre na fila que eu aviso no WhatsApp se vagar.",
  3: "Sem preferência? Quem liberar primeiro costuma te atender mais cedo.",
  4: "É do clube? Use o mesmo WhatsApp que o Johny cadastrou.",
  5: "O plano do clube vale de segunda a quinta. Sexta e sábado sai o preço da tabela.",
  6: "O QR do pix aparece aqui mesmo, sem precisar sair da tela.",
};

export function Dica({ passo }: { passo: number }) {
  const [escondida, setEscondida] = useState(false);
  const texto = DICAS[passo];

  if (escondida || !texto) return null;

  return (
    <div
      role="note"
      className="fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 flex items-start gap-2.5 rounded-card border border-borda-forte bg-superficie px-3.5 py-3 shadow-lg shadow-fundo-profundo/60 sm:inset-x-8 lg:static lg:inset-auto lg:z-auto lg:shadow-none"
    >
      <Lightbulb
        className="mt-0.5 h-4 w-4 shrink-0 text-acao"
        strokeWidth={2}
        aria-hidden
      />
      <p className="flex-1 text-xs leading-relaxed text-texto-medio">{texto}</p>
      <button
        type="button"
        onClick={() => setEscondida(true)}
        aria-label="Fechar dica"
        className="-my-1 -mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-pill text-texto-apagado transition-colors hover:text-texto"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
