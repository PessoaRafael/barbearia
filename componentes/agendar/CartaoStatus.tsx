"use client";

import Link from "next/link";
import { CalendarCheck, Timer } from "lucide-react";

import type { Servico } from "@/servicos";
import { moeda } from "@/lib/formato";
import { PainelPix } from "./PainelPix";
import type { FormaPagamento } from "./PassoPagamento";

export function CartaoStatus({
  servico,
  barbeiro,
  quando,
  pagamento,
  total,
  onRecomecar,
}: {
  servico: Servico;
  barbeiro: string;
  quando: string;
  pagamento: FormaPagamento;
  total: number;
  onRecomecar: () => void;
}) {
  const aguardando = pagamento === "pix";

  const linhas = [
    { rotulo: "Serviço", valor: `${servico.nome} · ${servico.duracaoLabel}` },
    { rotulo: "Quem corta", valor: barbeiro },
    { rotulo: "Quando", valor: quando },
    {
      rotulo: "Pagamento",
      valor:
        pagamento === "clube"
          ? total > 0
            ? `1 corte do clube + ${moeda(total)} na cadeira`
            : "1 corte do clube"
          : pagamento === "pix"
            ? "Pix"
            : "Dinheiro ou cartão na cadeira",
    },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-grande border border-borda-forte bg-superficie p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-pill border ${
            aguardando
              ? "border-alerta/50 text-alerta"
              : "border-acao/50 text-acao"
          }`}
        >
          {aguardando ? (
            <Timer className="h-5 w-5" strokeWidth={2} />
          ) : (
            <CalendarCheck className="h-5 w-5" strokeWidth={2} />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl">
            {aguardando ? "Reservado, aguardando o pix cair" : "Horário marcado"}
          </h2>
          <p className="text-sm text-texto-suave">
            {aguardando
              ? "A cadeira está no seu nome. Assim que o pix cair, o barbeiro confirma."
              : "Te esperamos na cadeira. Se precisar remarcar, avise com antecedência."}
          </p>
        </div>
      </div>

      <dl className="flex flex-col gap-2 rounded-card border border-borda bg-superficie-ativa p-4">
        {linhas.map((linha) => (
          <div
            key={linha.rotulo}
            className="flex items-baseline justify-between gap-4"
          >
            <dt className="shrink-0 text-sm text-texto-suave">{linha.rotulo}</dt>
            <dd className="num truncate text-right text-sm font-medium text-texto">
              {linha.valor}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 border-t border-borda pt-2">
          <dt className="text-sm text-texto-suave">Total</dt>
          <dd className="num font-titulo text-xl font-bold text-acao">
            {moeda(total)}
          </dd>
        </div>
      </dl>

      {aguardando ? <PainelPix valor={moeda(total)} /> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRecomecar}
          className="inline-flex min-h-toque items-center justify-center rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
        >
          Marcar outro horário
        </button>
        <Link
          href="/"
          className="inline-flex min-h-toque items-center justify-center rounded-pill px-5 font-titulo text-sm font-semibold text-texto-suave transition-colors hover:text-texto"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
