"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Crown,
  KeyRound,
  ListChecks,
  Scissors,
  Settings,
  Timer,
  Users,
  Wallet,
} from "lucide-react";

const ABAS = [
  { id: "agenda", nome: "Agenda", sub: "hoje e próximos dias", icone: CalendarDays },
  { id: "pix", nome: "Pix", sub: "conferir e liberar", icone: Timer },
  { id: "clube", nome: "Clube", sub: "assinantes e cobrança", icone: Crown },
  { id: "clientes", nome: "Clientes", sub: "histórico e sumidos", icone: Users },
  { id: "servicos", nome: "Serviços", sub: "preço e duração", icone: Scissors },
  { id: "caixa", nome: "Caixa", sub: "entradas do dia", icone: Wallet },
  { id: "fila", nome: "Fila", sub: "quem quer dia cheio", icone: ListChecks },
  { id: "equipe", nome: "Equipe", sub: "chaves de acesso", icone: KeyRound },
  { id: "config", nome: "Ajustes", sub: "pix, clube e reserva", icone: Settings },
];

/**
 * A barra lateral vive no layout, então ela não é redesenhada a cada aba.
 *
 * O destaque é otimista de propósito: o toque acende a aba na hora, antes de o
 * servidor responder. Sem isso, o Johny clica e a tela fica igual por um tempo,
 * que é a sensação de travado, mesmo quando a resposta chega rápido.
 */
export function BarraLateral({ pendentes }: { pendentes: number }) {
  const router = useRouter();
  const parametros = useSearchParams();
  const atual = parametros.get("aba") ?? "agenda";

  const [rodando, comecar] = useTransition();
  const [escolhida, escolher] = useOptimistic(atual);

  return (
    <nav className="lg:sticky lg:top-[76px] lg:w-[240px] lg:shrink-0">
      <ul className="trilho -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {ABAS.map((item) => {
          const ativo = item.id === escolhida;
          const Icone = item.icone;

          return (
            <li key={item.id} className="shrink-0 lg:shrink">
              <a
                href={`/painel?aba=${item.id}`}
                onClick={(evento) => {
                  // Ctrl/Cmd/meio continuam abrindo em outra aba do navegador.
                  if (
                    evento.metaKey ||
                    evento.ctrlKey ||
                    evento.shiftKey ||
                    evento.button !== 0
                  ) {
                    return;
                  }
                  evento.preventDefault();
                  comecar(() => {
                    escolher(item.id);
                    router.push(`/painel?aba=${item.id}`);
                  });
                }}
                className={`flex min-h-toque w-[178px] items-center gap-3 rounded-card border px-3 py-2.5 transition-colors lg:w-full ${
                  ativo
                    ? "border-acao bg-superficie-ativa"
                    : "border-borda bg-superficie hover:border-borda-forte"
                } ${rodando && ativo ? "opacity-70" : ""}`}
              >
                <Icone
                  className={`h-4 w-4 shrink-0 ${ativo ? "text-acao" : "text-texto-suave"}`}
                  strokeWidth={2}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-titulo text-sm font-semibold leading-tight">
                    {item.nome}
                  </span>
                  <span className="truncate text-xs text-texto-suave">
                    {item.sub}
                  </span>
                </span>
                {item.id === "pix" && pendentes > 0 ? (
                  <span className="num shrink-0 rounded-pill bg-alerta px-2 py-0.5 font-titulo text-xs font-bold text-fundo">
                    {pendentes}
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
