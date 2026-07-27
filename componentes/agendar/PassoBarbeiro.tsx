"use client";

import { Zap } from "lucide-react";

import { BARBEIROS } from "@/agenda";
import type { Servico } from "@/servicos";
import { Retrato } from "@/componentes/base";
import { contarLivres, rotuloDia, type Escolha } from "@/lib/disponibilidade";

export function PassoBarbeiro({
  servico,
  diaId,
  escolha,
  onEscolher,
}: {
  servico: Servico;
  diaId: string;
  escolha: Escolha | null;
  onEscolher: (valor: Escolha) => void;
}) {
  const dia = rotuloDia(diaId);
  const livresQualquer = contarLivres("qualquer", diaId, servico.duracaoMin);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onEscolher("qualquer")}
        className={`flex items-center gap-3 rounded-card border px-4 py-3.5 text-left transition-colors ${
          escolha === "qualquer"
            ? "border-acao bg-superficie-ativa"
            : "border-borda-forte bg-superficie-ativa hover:border-acao"
        }`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill border border-acao/50 text-acao">
          <Zap className="h-5 w-5" strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-titulo text-base font-semibold">
            Tanto faz, primeiro que liberar
          </span>
          <span className="num text-xs text-texto-suave">
            {livresQualquer} horários livres {dia}
          </span>
        </span>
      </button>

      <ul className="grid gap-2 sm:grid-cols-3">
        {BARBEIROS.map((barbeiro) => {
          const livres = contarLivres(barbeiro.id, diaId, servico.duracaoMin);
          const ativo = escolha === barbeiro.id;
          const cheio = livres === 0;
          return (
            <li key={barbeiro.id}>
              <button
                type="button"
                disabled={cheio}
                onClick={() => onEscolher(barbeiro.id)}
                className={`flex h-full w-full items-center gap-3 rounded-card border p-3 text-left transition-colors sm:flex-col sm:items-stretch ${
                  ativo
                    ? "border-acao bg-superficie-ativa"
                    : cheio
                      ? "cursor-not-allowed border-borda bg-superficie-apagada"
                      : "border-borda bg-superficie-ativa hover:border-borda-forte"
                }`}
              >
                <Retrato
                  iniciais={barbeiro.nome.slice(0, 2).toUpperCase()}
                  className="w-16 shrink-0 sm:w-full"
                  proporcao="1 / 1"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={`font-titulo text-base font-semibold ${
                      cheio ? "text-texto-suave" : "text-texto"
                    }`}
                  >
                    {barbeiro.nome}
                  </span>
                  <span className="text-xs text-texto-suave">
                    {barbeiro.especialidade}
                  </span>
                  <span
                    className={`num text-xs ${
                      cheio ? "text-texto-apagado" : "text-clube"
                    }`}
                  >
                    {cheio
                      ? `agenda cheia ${dia}`
                      : `${livres} livres ${dia}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
