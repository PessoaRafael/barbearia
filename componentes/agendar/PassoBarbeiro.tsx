"use client";

import { Zap } from "lucide-react";

import { Retrato } from "@/componentes/base";
import { rotuloDe, type Dia } from "@/lib/agenda/dias";
import type { Barbeiro, Escolha } from "./tipos";

/**
 * Quem corta, depois de o horário já estar escolhido.
 *
 * Antes este passo vinha antes do dia e contava vagas do dia inteiro, o que
 * dava "agenda cheia" sem o cliente ter escolhido dia nenhum. Agora a pergunta
 * é direta: quem está livre naquele horário.
 */
export function PassoBarbeiro({
  barbeiros,
  escolha,
  dia,
  hora,
  disponiveis,
  onEscolher,
}: {
  barbeiros: Barbeiro[];
  escolha: Escolha;
  temEscolha: boolean;
  dia: Dia;
  hora: string | null;
  /** Ids livres exatamente na hora escolhida. */
  disponiveis: string[];
  onEscolher: (id: Escolha) => void;
}) {
  const quando = `${rotuloDe(dia)} às ${hora ?? ""}`;
  const livres = barbeiros.filter((b) => disponiveis.includes(b.id));

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onEscolher(null)}
        className={`flex items-center gap-3 rounded-card border px-4 py-3.5 text-left transition-colors ${
          escolha === null
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
            {livres.length === 1
              ? `${livres[0].nome} está livre ${quando}`
              : `${livres.length} livres ${quando}`}
          </span>
        </span>
      </button>

      <ul className="grid gap-2 sm:grid-cols-3">
        {barbeiros.map((b) => {
          const ativo = escolha === b.id;
          const cheio = !disponiveis.includes(b.id);

          return (
            <li key={b.id}>
              <button
                type="button"
                disabled={cheio}
                onClick={() => onEscolher(b.id)}
                className={`flex h-full w-full items-center gap-3 rounded-card border p-3 text-left transition-colors sm:flex-col sm:items-stretch ${
                  ativo
                    ? "border-acao bg-superficie-ativa"
                    : cheio
                      ? "cursor-not-allowed border-borda bg-superficie-apagada"
                      : "border-borda bg-superficie-ativa hover:border-borda-forte"
                }`}
              >
                {/* Ocupado não mostra foto: vira só as iniciais apagadas. O
                    olho vai no rosto antes de ler "ocupado", e rosto em cor
                    cheia lê como disponível por mais que o card esteja
                    desabilitado. */}
                <Retrato
                  src={cheio ? undefined : (b.foto ?? undefined)}
                  alt={cheio ? "" : b.nomeCompleto}
                  iniciais={b.nome.slice(0, 2).toUpperCase()}
                  tamanhos="(min-width: 640px) 220px, 64px"
                  className={`w-16 shrink-0 sm:w-full ${cheio ? "opacity-50" : ""}`}
                  proporcao="1 / 1"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={`font-titulo text-base font-semibold ${
                      cheio ? "text-texto-suave" : "text-texto"
                    }`}
                  >
                    {b.nome}
                  </span>
                  <span className="text-xs text-texto-suave">
                    {b.especialidade}
                  </span>
                  <span
                    className={`num text-xs ${
                      cheio ? "text-texto-apagado" : "text-clube"
                    }`}
                  >
                    {cheio ? `ocupado ${quando}` : `livre ${quando}`}
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
