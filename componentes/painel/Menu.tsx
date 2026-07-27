"use client";

import { CalendarDays, Crown, Scissors, Users, Wallet } from "lucide-react";

import { NAV_PAINEL } from "@/painel";
import { BotaoCopiar } from "@/componentes/BotaoCopiar";
import { CASA } from "@/lib/casa";

const ICONES: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  agenda: CalendarDays,
  clube: Crown,
  clientes: Users,
  servicos: Scissors,
  caixa: Wallet,
};

export function Menu({
  atual,
  onTrocar,
}: {
  atual: string;
  onTrocar: (id: string) => void;
}) {
  return (
    <nav className="flex flex-col gap-3" aria-label="Seções do painel">
      <ul className="trilho -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {NAV_PAINEL.map((item) => {
          const Icone = ICONES[item.id] ?? CalendarDays;
          const ativo = item.id === atual;
          return (
            <li key={item.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onTrocar(item.id)}
                aria-current={ativo ? "page" : undefined}
                className={`flex min-h-toque w-[178px] items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-colors lg:w-full ${
                  ativo
                    ? "border-acao bg-superficie-ativa"
                    : "border-borda bg-superficie hover:border-borda-forte"
                }`}
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
                <span
                  className={`num shrink-0 font-titulo text-sm font-bold ${
                    ativo ? "text-acao" : "text-texto-suave"
                  }`}
                >
                  {item.badge}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 rounded-card border border-borda bg-superficie p-3">
        <span className="text-xs uppercase tracking-wide text-texto-apagado">
          Link de agendamento
        </span>
        <span className="truncate font-titulo text-sm font-semibold text-texto">
          {CASA.linkAgendamento}
        </span>
        <BotaoCopiar
          valor={`https://${CASA.linkAgendamento}`}
          rotulo="Copiar link"
          className="w-full"
        />
      </div>
    </nav>
  );
}
