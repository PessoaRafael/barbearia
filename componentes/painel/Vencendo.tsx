"use client";

import { useState, useTransition } from "react";
import { Check, MessageCircle } from "lucide-react";

import { registrarMensalidade } from "@/app/painel/acoes";
import { moedaCentavos, telefoneBonito } from "@/lib/formato";
import { CampoBusca, POR_VEZ, VerMais, achatar } from "./Lista";

export type Vencendo = {
  id: string;
  nome: string;
  telefone: string;
  plano: string;
  precoCentavos: number;
  cicloFim: string;
  dias: number;
  vencida: boolean;
};

/**
 * As mensalidades que estão para vencer, com o botão de renovar em cada uma.
 *
 * O cadastro em lote deixou 43 assinaturas caindo no mesmo dia. Sem aviso, o
 * Johny acordaria com quase sete mil reais para cobrar de uma vez — e cada dia
 * de atraso é um assinante pagando corte cheio e reclamando na cadeira.
 *
 * Vencido primeiro, depois o que vence antes: a ordem é a da urgência, não a
 * do alfabeto.
 */
export function Vencendo({ lista }: { lista: Vencendo[] }) {
  const [busca, setBusca] = useState("");
  const [ate, setAte] = useState(POR_VEZ);
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [, transicao] = useTransition();

  const alvo = achatar(busca);
  const vistos = lista.filter(
    (a) =>
      !feitos.has(a.id) &&
      (!alvo ||
        achatar(a.nome).includes(alvo) ||
        a.telefone.replace(/\D/g, "").includes(busca.replace(/\D/g, ""))),
  );

  if (!vistos.length && !feitos.size) return null;

  const total = vistos.reduce((s, a) => s + a.precoCentavos, 0);
  const vencidas = vistos.filter((a) => a.dias < 0).length;

  // Some da tela na hora: esperar o servidor para um botão desses faz
  // parecer travado, e ele vai clicar dezenas de vezes seguidas.
  const renovar = (id: string) => {
    setFeitos((s) => new Set(s).add(id));
    transicao(() => {
      void registrarMensalidade(id);
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-grande border border-alerta/40 bg-superficie p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg">
          Mensalidades vencendo · {vistos.length}
        </h2>
        <p className="num text-sm text-texto-suave">
          {moedaCentavos(total)} para receber
          {vencidas ? ` · ${vencidas} já vencida${vencidas > 1 ? "s" : ""}` : ""}
        </p>
        <p className="text-xs text-texto-apagado">
          Cobre antes de vencer. Assinante vencido paga o corte no valor
          normal, e descobre isso na cadeira.
        </p>
      </div>

      {lista.length > POR_VEZ ? (
        <CampoBusca
          valor={busca}
          onMudar={(v) => {
            setBusca(v);
            setAte(POR_VEZ);
          }}
          placeholder="Buscar por nome ou telefone"
        />
      ) : null}

      <ul className="flex flex-col gap-2">
        {vistos.slice(0, ate).map((a) => {
          const recado = `Oi ${a.nome.split(" ")[0]}! Sua mensalidade do ${a.plano} ${
            a.dias < 0
              ? "venceu"
              : a.dias === 0
                ? "vence hoje"
                : `vence em ${a.dias} dia${a.dias > 1 ? "s" : ""}`
          }. São ${moedaCentavos(a.precoCentavos)} no pix. Assim que cair eu já libero seus cortes.`;

          return (
            <li
              key={a.id}
              className={`flex flex-col gap-3 rounded-card border px-4 py-3 sm:flex-row sm:items-center ${
                a.dias < 0
                  ? "border-alerta/50 bg-alerta/5"
                  : "border-borda bg-superficie-ativa"
              }`}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="truncate font-titulo text-sm font-semibold">
                    {a.nome}
                  </span>
                  <span
                    className={`num shrink-0 text-xs ${
                      a.dias < 0 ? "text-alerta" : "text-texto-apagado"
                    }`}
                  >
                    {a.dias < 0
                      ? `venceu há ${-a.dias}d`
                      : a.dias === 0
                        ? "vence hoje"
                        : `em ${a.dias}d`}
                  </span>
                </span>
                <span className="num truncate text-xs text-texto-suave">
                  {telefoneBonito(a.telefone)} · {a.plano} ·{" "}
                  {moedaCentavos(a.precoCentavos)}
                </span>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {a.telefone ? (
                  <a
                    href={`https://wa.me/${numero(a.telefone)}?text=${encodeURIComponent(recado)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-toque items-center gap-1.5 rounded-pill border border-borda-forte px-3 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
                  >
                    <MessageCircle className="h-4 w-4" strokeWidth={2} />
                    Cobrar
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={() => renovar(a.id)}
                  title="Registra o pagamento e empurra o ciclo por mais um mês"
                  className="inline-flex min-h-toque items-center gap-1.5 rounded-pill bg-acao px-4 font-titulo text-sm font-bold text-acao-sobre transition-colors hover:bg-acao-hover"
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  Renovar
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <VerMais
        mostrando={Math.min(ate, vistos.length)}
        total={vistos.length}
        geral={lista.length - feitos.size}
        onMais={() => setAte((n) => n + POR_VEZ)}
      />

      {feitos.size ? (
        <p className="num text-xs text-clube">
          {feitos.size} renovada{feitos.size > 1 ? "s" : ""} agora.
        </p>
      ) : null}
    </section>
  );
}

function numero(telefone: string) {
  const digitos = telefone.replace(/\D/g, "");
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}
