"use client";

import { Zap } from "lucide-react";

import { Retrato } from "@/componentes/base";
import { rotuloDe, type Dia } from "@/lib/agenda/dias";
import type { Barbeiro, Escolha, Livre } from "./tipos";

export function PassoBarbeiro({
  barbeiros,
  escolha,
  dia,
  horarios,
  carregando,
  onEscolher,
}: {
  barbeiros: Barbeiro[];
  escolha: Escolha;
  temEscolha: boolean;
  dia: Dia;
  horarios: Livre[] | null;
  carregando: boolean;
  onEscolher: (id: Escolha) => void;
}) {
  const quando = rotuloDe(dia);

  const livresDe = (id: string) =>
    horarios?.filter((h) => h.barbeiros.includes(id)).length ?? 0;

  const contagem = (n: number) =>
    carregando || horarios === null ? "conferindo a agenda" : `${n} livres ${quando}`;

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
            {contagem(horarios?.length ?? 0)}
          </span>
        </span>
      </button>

      <ul className="grid gap-2 sm:grid-cols-3">
        {barbeiros.map((b) => {
          const livres = livresDe(b.id);
          const ativo = escolha === b.id;
          const cheio = !carregando && horarios !== null && livres === 0;

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
                <Retrato
                  src={b.foto ?? undefined}
                  alt={b.nomeCompleto}
                  iniciais={b.nome.slice(0, 2).toUpperCase()}
                  tamanhos="(min-width: 640px) 220px, 64px"
                  className="w-16 shrink-0 sm:w-full"
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
                    {cheio ? `agenda cheia ${quando}` : contagem(livres)}
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
