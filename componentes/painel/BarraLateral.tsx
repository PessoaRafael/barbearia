"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Crown,
  KeyRound,
  ListChecks,
  Scissors,
  FileDown,
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
 * Navegação do painel.
 *
 * No celular é grade de três colunas: as nove abas cabem na tela de uma vez.
 * Em trilho horizontal apareciam duas, e o Johny tinha que adivinhar que
 * existia mais coisa para arrastar. No desktop volta a ser a lista de lado,
 * onde há largura para a linha de apoio de cada aba.
 *
 * O destaque é local de propósito: acende no toque, sem esperar o servidor.
 * Nada de `startTransition` em volta do Link, que faria o React segurar a tela
 * antiga até a nova ficar pronta, justamente o contrário do que se quer aqui.
 */
export function BarraLateral({
  pendentes,
  novos,
}: {
  pendentes: number;
  /** Horários que entraram desde a última vez que ele abriu a agenda. */
  novos: number;
}) {
  const parametros = useSearchParams();
  const atual = parametros.get("aba") ?? "agenda";

  const [tocada, setTocada] = useState<string | null>(null);
  useEffect(() => setTocada(null), [atual]);

  /**
   * O crachá some no toque, não na resposta do servidor.
   *
   * A barra vive no layout e não é redesenhada ao trocar de aba, então esperar
   * o servidor deixaria o número aceso depois de ele já ter olhado — e um
   * aviso que não apaga quando você atende vira ruído em dois dias.
   */
  const [viuAgenda, setViuAgenda] = useState(false);

  const escolhida = tocada ?? atual;

  return (
    <nav className="lg:sticky lg:top-[76px] lg:w-[240px] lg:shrink-0">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:flex lg:flex-col">
        {ABAS.map((item) => {
          const ativo = item.id === escolhida;
          const Icone = item.icone;
          const conta =
            item.id === "pix" && pendentes > 0
              ? pendentes
              : item.id === "agenda" && novos > 0 && !viuAgenda
                ? novos
                : null;

          return (
            <li key={item.id}>
              <Link
                href={`/painel?aba=${item.id}`}
                onClick={() => {
                  setTocada(item.id);
                  if (item.id === "agenda") setViuAgenda(true);
                }}
                aria-current={ativo ? "page" : undefined}
                className={`relative flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-card border px-2 py-2 text-center transition-colors lg:min-h-toque lg:flex-row lg:items-center lg:gap-3 lg:px-3 lg:py-2.5 lg:text-left ${
                  ativo
                    ? "border-acao bg-superficie-ativa"
                    : "border-borda bg-superficie hover:border-borda-forte"
                }`}
              >
                <Icone
                  className={`h-5 w-5 shrink-0 lg:h-4 lg:w-4 ${
                    ativo ? "text-acao" : "text-texto-suave"
                  }`}
                  strokeWidth={2}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-titulo text-sm font-semibold leading-tight">
                    {item.nome}
                  </span>
                  <span className="hidden truncate text-xs text-texto-suave lg:block">
                    {item.sub}
                  </span>
                </span>

                {/* No celular o crachá encosta no canto do bloco; na lista do
                    desktop ele fica no fim da linha, como antes. */}
                {conta ? (
                  <span
                    className={`num absolute right-1.5 top-1.5 rounded-pill px-1.5 py-0.5 font-titulo text-xs font-bold text-fundo lg:static lg:shrink-0 lg:px-2 ${
                      item.id === "pix" ? "bg-alerta" : "bg-acao"
                    }`}
                  >
                    {conta}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Fora da lista de abas de propósito: não é uma tela do painel, é um
          papel para levar embora. Mora em /relatorio para o cabeçalho e esta
          barra não saírem impressos junto. */}
      <Link
        href="/relatorio"
        className="mt-2 flex min-h-toque items-center justify-center gap-2 rounded-card border border-borda bg-superficie px-3 font-titulo text-sm font-semibold text-texto-suave transition-colors hover:border-acao hover:text-acao lg:justify-start"
      >
        <FileDown className="h-4 w-4 shrink-0" strokeWidth={2} />
        Fechamento do dia
      </Link>
    </nav>
  );
}
