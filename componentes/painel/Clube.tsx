"use client";

import { useState, useTransition } from "react";
import { Check, Crown, Plus, UserPlus, X } from "lucide-react";

import {
  cancelarAssinatura,
  inscreverNoClube,
  registrarMensalidade,
} from "@/app/painel/acoes";
import { AvisoWhatsapp } from "./Acoes";
import { moedaCentavos, telefoneBonito } from "@/lib/formato";
import { textoDe } from "@/lib/notify/textos";

export type Assinante = {
  id: string;
  status: string;
  precoCentavos: number;
  cortesMes: number;
  cicloFim: string;
  proximaCobranca: string;
  nome: string;
  telefone: string;
};

const pill =
  "inline-flex min-h-toque items-center justify-center gap-2 rounded-pill px-4 font-titulo text-sm font-semibold transition-colors";

export function Clube({
  lista,
  pixKey,
}: {
  lista: Assinante[];
  pixKey: string;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const vencidos = lista.filter((a) => a.status === "vencida");

  return (
    <section className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Clube · {lista.length} assinantes</h2>
        <button
          type="button"
          onClick={() => setAbrindo(!abrindo)}
          className={`${pill} bg-acao text-acao-sobre hover:bg-acao-hover`}
        >
          {abrindo ? (
            <X className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <UserPlus className="h-4 w-4" strokeWidth={2.5} />
          )}
          {abrindo ? "Fechar" : "Colocar no clube"}
        </button>
      </div>

      {abrindo ? <Inscrever onPronto={() => setAbrindo(false)} /> : null}

      {lista.length === 0 ? (
        <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-10 text-center text-sm text-texto-suave">
          Nenhum assinante ainda. Coloque o primeiro pelo botão acima — é o
          WhatsApp dele que liga tudo.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((a) => (
            <li
              key={a.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border px-4 py-3 ${
                a.status === "vencida"
                  ? "border-alerta/40 bg-superficie-ativa"
                  : "border-borda bg-superficie-ativa"
              }`}
            >
              <div className="flex min-w-0 flex-[1_1_50%] flex-col">
                <span className="flex items-center gap-2 truncate font-titulo text-sm font-semibold">
                  <Crown
                    className={`h-3.5 w-3.5 shrink-0 ${
                      a.status === "vencida" ? "text-alerta" : "text-clube"
                    }`}
                    strokeWidth={2.5}
                  />
                  {a.nome}
                </span>
                <span
                  className={`num truncate text-xs ${
                    a.status === "vencida" ? "text-alerta" : "text-texto-suave"
                  }`}
                >
                  {telefoneBonito(a.telefone)} ·{" "}
                  {a.status === "vencida"
                    ? `venceu em ${a.proximaCobranca}`
                    : `vale até ${a.cicloFim}`}
                </span>
              </div>

              <span className="num ml-auto shrink-0 font-titulo text-base font-bold">
                {moedaCentavos(a.precoCentavos)}
              </span>

              <Recebi assinaturaId={a.id} vencida={a.status === "vencida"} />

              {a.status === "vencida" ? (
                <AvisoWhatsapp
                  telefone={a.telefone}
                  texto={textoDe("mensalidade_vencida", {
                    cliente: a.nome.split(" ")[0],
                    quando: a.proximaCobranca,
                    valor: moedaCentavos(a.precoCentavos),
                    pix: pixKey,
                  })}
                />
              ) : null}

              <Tirar assinaturaId={a.id} />
            </li>
          ))}
        </ul>
      )}

      {vencidos.length ? (
        <p className="text-xs text-alerta">
          {vencidos.length} mensalidade(s) vencida(s). Enquanto está vencida, o
          cliente não gasta crédito — o corte sai avulso.
        </p>
      ) : null}

      <p className="text-xs text-texto-apagado">
        O WhatsApp é a identidade. Assim que ele digitar esse número no
        agendamento, o saldo de cortes aparece sozinho para ele.
      </p>
    </section>
  );
}

function Inscrever({ onPronto }: { onPronto: () => void }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, comecar] = useTransition();

  const campo =
    "min-h-toque w-full rounded-bloco border border-borda bg-superficie px-3 text-sm text-texto placeholder:text-texto-apagado";
  const valido =
    nome.trim().length >= 2 && telefone.replace(/\D/g, "").length >= 10;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-borda-forte bg-superficie-ativa p-4">
      <span className="text-sm text-texto-suave">
        Se ele já cortou aqui alguma vez, a assinatura cola no cadastro que já
        existe — basta o mesmo número.
      </span>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do assinante"
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

      <button
        type="button"
        disabled={!valido || rodando}
        onClick={() =>
          comecar(async () => {
            const r = await inscreverNoClube({ nome, telefone });
            if (r.erro) setErro(r.erro);
            else {
              setNome("");
              setTelefone("");
              onPronto();
            }
          })
        }
        className={`${pill} sm:self-start ${
          valido && !rodando
            ? "bg-acao text-acao-sobre hover:bg-acao-hover"
            : "cursor-not-allowed border border-borda bg-superficie-apagada text-texto-apagado"
        }`}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        {rodando ? "Cadastrando..." : "Colocar no clube"}
      </button>
    </div>
  );
}

/** Recebeu a mensalidade no pix ou na mão: empurra o ciclo um mês. */
function Recebi({
  assinaturaId,
  vencida,
}: {
  assinaturaId: string;
  vencida: boolean;
}) {
  const [rodando, comecar] = useTransition();

  return (
    <button
      type="button"
      disabled={rodando}
      onClick={() => comecar(() => registrarMensalidade(assinaturaId).then(() => {}))}
      title="Registra o pagamento e renova o ciclo por um mês"
      className={`${pill} shrink-0 ${
        vencida
          ? "bg-acao text-acao-sobre hover:bg-acao-hover"
          : "border border-borda-forte text-texto hover:border-acao"
      } disabled:opacity-60`}
    >
      <Check className="h-4 w-4" strokeWidth={2.5} />
      {rodando ? "..." : "Recebi o mês"}
    </button>
  );
}

function Tirar({ assinaturaId }: { assinaturaId: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [rodando, comecar] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-toque shrink-0 items-center rounded-pill border border-borda px-3 font-titulo text-sm font-semibold text-texto-suave transition-colors hover:border-alerta hover:text-alerta"
      >
        Tirar
      </button>
    );
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={rodando}
        onClick={() => comecar(() => cancelarAssinatura(assinaturaId).then(() => {}))}
        className={`${pill} border border-alerta/60 text-alerta hover:bg-alerta/10`}
      >
        Tirar mesmo
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className={`${pill} border border-borda-forte text-texto`}
      >
        Deixa
      </button>
    </div>
  );
}
