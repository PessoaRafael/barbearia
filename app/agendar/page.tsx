"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import { BARBEIROS, type BarbeiroId } from "@/agenda";
import { CLIENTE_LOGADO, PIX } from "@/painel";
import { calcularValor, servicoPorId } from "@/servicos";
import { Logo } from "@/componentes/base";
import { CardClube, TrilhaResumo } from "@/componentes/agendar/CardClube";
import { CartaoStatus } from "@/componentes/agendar/CartaoStatus";
import { PainelPix } from "@/componentes/agendar/PainelPix";
import { Passo, type EstadoPasso } from "@/componentes/agendar/Passo";
import { PassoBarbeiro } from "@/componentes/agendar/PassoBarbeiro";
import { PassoHorario } from "@/componentes/agendar/PassoHorario";
import {
  PassoPagamento,
  type FormaPagamento,
} from "@/componentes/agendar/PassoPagamento";
import { PassoServico } from "@/componentes/agendar/PassoServico";
import {
  barbeirosLivresEm,
  primeiroDiaAberto,
  type Escolha,
} from "@/lib/disponibilidade";
import { moeda } from "@/lib/formato";
import { useExtras, useOperacao } from "@/lib/operacao";
import { rotuloDoDia } from "@/lib/semana";

export default function Agendar() {
  const [servicoId, setServicoId] = useState<string | null>(null);
  const [barbeiro, setBarbeiro] = useState<Escolha | null>(null);
  const [diaId, setDiaId] = useState<string>(primeiroDiaAberto());
  const [hora, setHora] = useState<string | null>(null);
  const [pagamento, setPagamento] = useState<FormaPagamento | null>(null);
  const [avulso, setAvulso] = useState(false);
  const [passoAberto, setPassoAberto] = useState(1);
  const [confirmado, setConfirmado] = useState(false);
  // "Tanto faz" vira um nome de verdade na hora de confirmar.
  const [definido, setDefinido] = useState<BarbeiroId | null>(null);

  const { operacao, semanaAberta, clubeCheio, marcar } = useOperacao();
  const extras = useExtras(operacao, diaId);

  const servico = servicoPorId(servicoId);
  const cortesRestantes = CLIENTE_LOGADO.cortesTotais - CLIENTE_LOGADO.cortesUsados;

  // O serviço entra no clube; se a barbearia fechou as vagas do dia, a opção
  // aparece travada em vez de sumir, para o assinante entender o porquê.
  const servicoNoClube =
    Boolean(servico && servico.clubeAbate > 0) &&
    CLIENTE_LOGADO.assinante &&
    cortesRestantes > 0;
  const semVagaNoClube = clubeCheio(diaId);
  const cobreClube = servicoNoClube && !semVagaNoClube;

  const total = servico
    ? calcularValor(servico, pagamento === "clube").aPagar
    : null;

  const faltam = [servicoId, barbeiro, hora, pagamento].filter(
    (v) => v === null,
  ).length;

  const nomeBarbeiro = definido
    ? (BARBEIROS.find((b) => b.id === definido)?.nome ?? "")
    : barbeiro === "qualquer"
      ? "Primeiro que liberar"
      : (BARBEIROS.find((b) => b.id === barbeiro)?.nome ?? "");

  const quando = hora ? `${rotuloDoDia(semanaAberta, diaId)} às ${hora}` : "";

  const usadosNoClube =
    CLIENTE_LOGADO.cortesUsados +
    (confirmado && pagamento === "clube" ? 1 : 0);

  function escolherServico(id: string) {
    if (id !== servicoId) {
      setBarbeiro(null);
      setHora(null);
      setPagamento(null);
      setAvulso(false);
    }
    setServicoId(id);
    setPassoAberto(2);
  }

  function escolherBarbeiro(valor: Escolha) {
    if (valor !== barbeiro) {
      setHora(null);
      setPagamento(null);
      setAvulso(false);
    }
    setBarbeiro(valor);
    setPassoAberto(3);
  }

  function escolherDia(id: string) {
    setDiaId(id);
    setHora(null);
    setPagamento(null);
    setAvulso(false);
  }

  function escolherHora(h: string) {
    setHora(h);
    if (h !== hora) {
      setPagamento(null);
      setAvulso(false);
    }
    setPassoAberto(4);
  }

  function escolherPagamento(forma: FormaPagamento) {
    setPagamento(forma);
    if (forma === "clube") setAvulso(false);
    setPassoAberto(5);
  }

  /**
   * Grava a marcação para o painel enxergar: a cadeira some da grade e, se o
   * pagamento for pelo clube, gasta uma das vagas do dia.
   */
  function confirmar() {
    if (!servico || !pagamento || !hora) return;

    const quem: BarbeiroId =
      barbeiro === "qualquer" || barbeiro === null
        ? (barbeirosLivresEm(diaId, hora, servico.duracaoMin, extras)[0] ??
          BARBEIROS[0].id)
        : barbeiro;

    marcar({
      id: `${diaId}-${quem}-${hora}`,
      diaId,
      barbeiro: quem,
      hora,
      servicoId: servico.id,
      cliente: CLIENTE_LOGADO.nomeCompleto,
      clube: pagamento === "clube",
      origem: "site",
    });

    setDefinido(quem);
    setConfirmado(true);
  }

  function recomecar() {
    setServicoId(null);
    setBarbeiro(null);
    setDiaId(primeiroDiaAberto());
    setHora(null);
    setPagamento(null);
    setAvulso(false);
    setPassoAberto(1);
    setConfirmado(false);
    setDefinido(null);
  }

  const concluido = [
    Boolean(servico),
    Boolean(barbeiro),
    Boolean(hora),
    Boolean(pagamento),
  ];
  const travado = [false, !servico, !barbeiro, !hora, !pagamento];

  function estado(numero: number): EstadoPasso {
    if (travado[numero - 1]) return "travado";
    if (passoAberto === numero) return "aberto";
    if (numero <= 4 && concluido[numero - 1]) return "resumo";
    return "pendente";
  }

  const resumoPagamento =
    pagamento === "clube"
      ? total && total > 0
        ? `1 corte do clube + ${moeda(total)}`
        : "1 corte do clube"
      : pagamento === "pix"
        ? `Pix · reserva de ${PIX.reservaMinutos} min`
        : pagamento === "cadeira"
          ? "Dinheiro ou cartão na cadeira"
          : "";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 py-3 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="-ml-2 inline-flex min-h-toque min-w-toque items-center justify-center rounded-pill text-texto-suave transition-colors hover:text-texto"
            aria-label="Voltar para o início"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <Logo tamanho={36} />
          <span className="truncate font-titulo text-base font-bold">
            Johny Barbearia
          </span>
          <span className="ml-auto truncate text-xs text-texto-suave">
            {CLIENTE_LOGADO.nome}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 pb-32 pt-6 sm:px-8 lg:px-10 lg:pb-14">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">Agendar horário</h1>
          <p className="text-texto-suave">
            Cinco passos, um de cada vez. Dá para voltar em qualquer um.
          </p>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-[76px] lg:order-2 lg:w-[300px] lg:shrink-0 xl:w-[340px]">
            <CardClube usados={usadosNoClube} />
            <div className="hidden lg:block">
              <TrilhaResumo
                etapas={[
                  {
                    rotulo: "Serviço",
                    valor: servico
                      ? `${servico.nome} · ${servico.duracaoLabel}`
                      : null,
                  },
                  { rotulo: "Quem corta", valor: barbeiro ? nomeBarbeiro : null },
                  { rotulo: "Quando", valor: hora ? quando : null },
                  { rotulo: "Pagamento", valor: pagamento ? resumoPagamento : null },
                ]}
                total={servico ? total : null}
              />
            </div>
          </aside>

          <div className="flex flex-1 flex-col gap-3 lg:order-1">
            {confirmado && servico && pagamento ? (
              <CartaoStatus
                servico={servico}
                barbeiro={nomeBarbeiro}
                quando={quando}
                pagamento={pagamento}
                total={total ?? 0}
                onRecomecar={recomecar}
              />
            ) : (
              <>
                <Passo
                  numero={1}
                  titulo="Serviço"
                  estado={estado(1)}
                  resumo={
                    servico
                      ? `${servico.nome} · ${servico.duracaoLabel} · ${moeda(servico.preco)}`
                      : undefined
                  }
                  onAbrir={() => setPassoAberto(1)}
                >
                  <PassoServico servico={servico} onEscolher={escolherServico} />
                </Passo>

                <Passo
                  numero={2}
                  titulo="Quem corta"
                  estado={estado(2)}
                  motivo="liberado depois do serviço"
                  resumo={nomeBarbeiro}
                  onAbrir={() => setPassoAberto(2)}
                >
                  {servico ? (
                    <PassoBarbeiro
                      servico={servico}
                      diaId={diaId}
                      escolha={barbeiro}
                      extras={extras}
                      semana={semanaAberta}
                      onEscolher={escolherBarbeiro}
                    />
                  ) : null}
                </Passo>

                <Passo
                  numero={3}
                  titulo="Quando"
                  estado={estado(3)}
                  motivo="liberado depois do barbeiro"
                  resumo={quando}
                  onAbrir={() => setPassoAberto(3)}
                >
                  {servico && barbeiro ? (
                    <PassoHorario
                      servico={servico}
                      escolha={barbeiro}
                      diaId={diaId}
                      hora={hora}
                      extras={extras}
                      semana={semanaAberta}
                      onDia={escolherDia}
                      onHora={escolherHora}
                    />
                  ) : null}
                </Passo>

                <Passo
                  numero={4}
                  titulo="Pagamento"
                  estado={estado(4)}
                  motivo="liberado depois do horário"
                  resumo={resumoPagamento}
                  onAbrir={() => setPassoAberto(4)}
                >
                  {servico ? (
                    <PassoPagamento
                      servico={servico}
                      cobreClube={servicoNoClube}
                      clubeCheio={semVagaNoClube}
                      cortesRestantes={cortesRestantes}
                      pagamento={pagamento}
                      avulso={avulso}
                      onEscolher={escolherPagamento}
                      onAvulso={() => {
                        setAvulso(true);
                        setPagamento(null);
                      }}
                    />
                  ) : null}
                </Passo>

                <Passo
                  numero={5}
                  titulo="Confirmar"
                  estado={estado(5)}
                  motivo="liberado depois do pagamento"
                  acaoPendente="abrir"
                  onAbrir={() => setPassoAberto(5)}
                >
                  {servico && pagamento ? (
                    <div className="flex flex-col gap-4">
                      {pagamento === "pix" ? (
                        <PainelPix valor={moeda(total ?? 0)} />
                      ) : null}
                      <p className="text-sm text-texto-medio">
                        {servico.nome} · {nomeBarbeiro} · {quando} ·{" "}
                        {resumoPagamento}
                      </p>
                      <button
                        type="button"
                        onClick={confirmar}
                        className="num inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill bg-acao px-6 font-titulo text-base font-bold text-acao-sobre transition-colors hover:bg-acao-hover"
                      >
                        Confirmar horário · {moeda(total ?? 0)}
                      </button>
                    </div>
                  ) : null}
                </Passo>
              </>
            )}
          </div>
        </div>
      </main>

      {!confirmado ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-superficie px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <div className="flex items-center gap-4">
            <div className="flex min-w-0 flex-col">
              <span className="text-xs text-texto-suave">Total a pagar</span>
              <span
                className={`num font-titulo text-xl font-bold ${
                  total === null ? "text-texto-apagado" : "text-acao"
                }`}
              >
                {total === null ? "—" : moeda(total)}
              </span>
            </div>
            <button
              type="button"
              disabled={faltam > 0}
              onClick={confirmar}
              className={`num inline-flex min-h-toque flex-1 items-center justify-center rounded-pill px-5 font-titulo text-base font-bold transition-colors ${
                faltam > 0
                  ? "cursor-not-allowed border border-borda bg-superficie-apagada text-texto-apagado"
                  : "bg-acao text-acao-sobre hover:bg-acao-hover"
              }`}
            >
              {faltam > 0 ? `falta ${faltam}` : "Confirmar"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
