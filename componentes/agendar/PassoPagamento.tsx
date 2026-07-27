"use client";

import { Banknote, Crown, QrCode, Wallet } from "lucide-react";

import { calcularValor, type Servico } from "@/servicos";
import { moeda } from "@/lib/formato";
import { PainelPix } from "./PainelPix";

export type FormaPagamento = "clube" | "pix" | "cadeira";

export function PassoPagamento({
  servico,
  cobreClube,
  cortesRestantes,
  pagamento,
  avulso,
  onEscolher,
  onAvulso,
}: {
  servico: Servico;
  cobreClube: boolean;
  cortesRestantes: number;
  pagamento: FormaPagamento | null;
  avulso: boolean;
  onEscolher: (forma: FormaPagamento) => void;
  onAvulso: () => void;
}) {
  const comClube = calcularValor(servico, true).aPagar;
  const cheio = moeda(servico.preco);

  if (cobreClube) {
    return (
      <div className="flex flex-col gap-3">
        <Opcao
          icone={<Crown className="h-5 w-5" strokeWidth={2} />}
          titulo="Usar 1 corte do clube"
          apoio={
            comClube > 0
              ? `O clube cobre o corte. A barba sai por ${moeda(comClube)} na cadeira.`
              : `Sobram ${cortesRestantes - 1} cortes no mês depois desse.`
          }
          valor={moeda(comClube)}
          ativo={pagamento === "clube"}
          destaque
          tomDestaque="clube"
          onClick={() => onEscolher("clube")}
        />

        <div
          className={`flex flex-col gap-3 rounded-card border transition-colors ${
            avulso ? "border-borda-forte bg-superficie-ativa" : "border-transparent"
          }`}
        >
          <Opcao
            icone={<Wallet className="h-5 w-5" strokeWidth={2} />}
            titulo="Pagar à parte e guardar os cortes"
            apoio={`Seus ${cortesRestantes} cortes continuam válidos neste mês.`}
            valor={cheio}
            ativo={avulso}
            onClick={onAvulso}
            semBorda={avulso}
          />

          {avulso ? (
            <div className="flex flex-col gap-3 px-3 pb-3">
              <FormasAvulsas
                servico={servico}
                pagamento={pagamento}
                onEscolher={onEscolher}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <FormasAvulsas
      servico={servico}
      pagamento={pagamento}
      onEscolher={onEscolher}
    />
  );
}

function FormasAvulsas({
  servico,
  pagamento,
  onEscolher,
}: {
  servico: Servico;
  pagamento: FormaPagamento | null;
  onEscolher: (forma: FormaPagamento) => void;
}) {
  const valor = moeda(servico.preco);
  return (
    <div className="flex flex-col gap-3">
      <Opcao
        icone={<QrCode className="h-5 w-5" strokeWidth={2} />}
        titulo="Pagar no pix e garantir o horário"
        apoio="A cadeira fica reservada no seu nome enquanto o pix não cai."
        valor={valor}
        ativo={pagamento === "pix"}
        destaque
        onClick={() => onEscolher("pix")}
      />

      {pagamento === "pix" ? <PainelPix valor={valor} /> : null}

      <Opcao
        icone={<Banknote className="h-5 w-5" strokeWidth={2} />}
        titulo="Dinheiro ou cartão na cadeira"
        apoio="Você acerta com o barbeiro no fim do corte."
        valor={valor}
        ativo={pagamento === "cadeira"}
        onClick={() => onEscolher("cadeira")}
      />
    </div>
  );
}

function Opcao({
  icone,
  titulo,
  apoio,
  valor,
  ativo,
  destaque = false,
  tomDestaque = "acao",
  semBorda = false,
  onClick,
}: {
  icone: React.ReactNode;
  titulo: string;
  apoio: string;
  valor: string;
  ativo: boolean;
  destaque?: boolean;
  tomDestaque?: "acao" | "clube";
  semBorda?: boolean;
  onClick: () => void;
}) {
  const borda = ativo
    ? "border-acao bg-superficie-ativa"
    : destaque
      ? tomDestaque === "clube"
        ? "border-clube/50 bg-superficie-ativa hover:border-clube"
        : "border-borda-forte bg-superficie-ativa hover:border-acao"
      : "border-borda bg-superficie-ativa hover:border-borda-forte";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex items-start gap-3 rounded-card px-4 py-3.5 text-left transition-colors ${
        semBorda ? "border border-transparent bg-transparent" : `border ${borda}`
      }`}
    >
      <span
        className={`mt-0.5 shrink-0 ${
          ativo ? "text-acao" : tomDestaque === "clube" && destaque ? "text-clube" : "text-texto-suave"
        }`}
      >
        {icone}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-titulo text-base font-semibold">{titulo}</span>
        <span className="text-xs text-texto-suave">{apoio}</span>
      </span>
      <span
        className={`num shrink-0 font-titulo text-lg font-bold ${
          ativo ? "text-acao" : "text-texto"
        }`}
      >
        {valor}
      </span>
    </button>
  );
}
