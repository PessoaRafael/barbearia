"use client";

import { useState, useTransition } from "react";
import { BellRing, Check } from "lucide-react";

import { entrarNaFila } from "@/app/agendar/acoes";

/**
 * Dia cheio não precisa perder o cliente: ele deixa o contato e é avisado
 * quando alguém cancela, por ordem de chegada.
 */
export function FilaDeEspera({
  data,
  servicoId,
  barbeiroId,
}: {
  data: string;
  servicoId: string;
  barbeiroId: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pronto, setPronto] = useState<null | "novo" | "repetido">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, comecar] = useTransition();

  const valido = nome.trim().length >= 2 && telefone.replace(/\D/g, "").length >= 10;
  const campo =
    "min-h-toque w-full rounded-bloco border border-borda bg-superficie px-3 text-sm text-texto placeholder:text-texto-apagado";

  if (pronto) {
    return (
      <p className="flex items-start gap-2 rounded-card border border-clube/40 bg-superficie-ativa px-4 py-3 text-sm text-clube">
        <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
        {pronto === "repetido"
          ? "Você já estava na fila desse dia. Te aviso se vagar."
          : "Pronto. Se alguém cancelar nesse dia, te chamo por ordem de chegada."}
      </p>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-toque items-center justify-center gap-2 rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
      >
        <BellRing className="h-4 w-4" strokeWidth={2} />
        Me avisa se vagar nesse dia
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-borda-forte bg-superficie-ativa p-4">
      <span className="text-sm text-texto-suave">
        Deixa seu contato. Se alguém cancelar nesse dia, você é chamado por
        ordem de chegada.
      </span>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome"
          className={campo}
        />
        <input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(84) 99999-9999"
          inputMode="tel"
          className={`num ${campo}`}
        />
      </div>

      {erro ? <span className="text-xs text-alerta">{erro}</span> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!valido || rodando}
          onClick={() =>
            comecar(async () => {
              const r = await entrarNaFila({
                data,
                servicoId,
                barbeiroId,
                nome,
                telefone,
              });
              if (r.erro) setErro(r.erro);
              else setPronto(r.jaEstava ? "repetido" : "novo");
            })
          }
          className={`inline-flex min-h-toque items-center justify-center rounded-pill px-5 font-titulo text-sm font-bold transition-colors ${
            valido && !rodando
              ? "bg-acao text-acao-sobre hover:bg-acao-hover"
              : "cursor-not-allowed border border-borda bg-superficie-apagada text-texto-apagado"
          }`}
        >
          {rodando ? "Entrando..." : "Entrar na fila"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="inline-flex min-h-toque items-center justify-center rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto"
        >
          Deixa
        </button>
      </div>
    </div>
  );
}
