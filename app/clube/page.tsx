import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, Clock, Crown, Scissors, TriangleAlert } from "lucide-react";

import { Logo } from "@/componentes/base";
import { Desmarcar } from "@/componentes/clube/Desmarcar";
import { sair } from "@/app/entrar/acoes";
import { lerSessao } from "@/lib/auth/sessao";
import { diasEmTexto } from "@/lib/dados/casa";
import { moedaCentavos, telefoneBonito } from "@/lib/formato";
import { Aniversario } from "@/componentes/clube/Aniversario";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Área do assinante.
 *
 * Tudo vem da chave que está no cookie, nunca de id na URL: assim ninguém
 * abre a área de outra pessoa trocando um número.
 */
export const dynamic = "force-dynamic";

type Marcado = {
  inicio: string;
  servico: string;
  barbeiro: string;
  status?: string;
  token?: string;
  valor_centavos: number;
  usou_clube?: boolean;
};

type Area = {
  nome: string;
  telefone: string;
  nascimento: string | null;
  total_cortes: number;
  assinante: boolean;
  vencida: boolean;
  ciclo_fim: string | null;
  proxima_cobranca: string | null;
  mensalidade: number;
  ilimitado: boolean;
  cortes_mes: number;
  plano: { nome: string; categorias: string[]; dias_semana: number[] } | null;
  proximos: Marcado[];
  historico: Marcado[];
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const dia = (data: string) =>
  new Date(`${data}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });

export default async function AreaDoClube() {
  const sessao = await lerSessao();
  if (!sessao) redirect("/entrar");
  if (sessao.papel === "owner") redirect("/painel");
  if (sessao.papel === "barber") redirect("/agenda");

  const barbearia = sessao.casa;
  const { data } = await clienteServico().rpc("area_do_cliente", {
    p_chave: sessao.chaveId,
  });

  if (!data) redirect("/entrar");
  const area = data as Area;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-3 sm:px-8">
          <Logo tamanho={36} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-titulo text-base font-bold leading-tight">
              {area.nome.split(" ")[0]}
            </span>
            <span className="truncate text-xs text-texto-suave">
              sua área no {barbearia.nome}
            </span>
          </div>
          <form action={sair} className="ml-auto">
            <button
              type="submit"
              className="inline-flex min-h-toque items-center rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 py-6 sm:px-8">
        {/* O estado da mensalidade vem primeiro: é o que decide se o corte
            dele sai de graça hoje. */}
        <section
          className={`flex flex-col gap-3 rounded-grande border p-5 ${
            area.vencida
              ? "border-alerta/50 bg-superficie"
              : area.assinante
                ? "border-clube/40 bg-superficie"
                : "border-borda bg-superficie"
          }`}
        >
          <div className="flex items-center gap-2">
            <Crown
              className={`h-5 w-5 shrink-0 ${
                area.vencida
                  ? "text-alerta"
                  : area.assinante
                    ? "text-clube"
                    : "text-texto-suave"
              }`}
              strokeWidth={2.5}
            />
            <span className="font-titulo text-lg font-bold">
              {area.plano?.nome ?? "Clube Johny"}
            </span>
          </div>

          {area.assinante ? (
            <>
              <p className="text-texto-medio">
                Sua mensalidade está em dia.{" "}
                {area.plano
                  ? `${area.plano.categorias.join(" e ")} sem limite de vezes.`
                  : area.ilimitado
                    ? "Corte quantas vezes quiser: não paga nada pelo corte."
                    : `Você tem ${area.cortes_mes} cortes neste ciclo.`}
              </p>
              {/* O dia é a regra que mais gera discussão na cadeira: fica
                  escrita aqui, não só na landing. */}
              {area.plano ? (
                <p className="text-sm text-texto-suave">
                  Atendimento de {diasEmTexto(area.plano.dias_semana)}. Fora
                  desses dias a agenda fica para quem corta avulso.
                </p>
              ) : null}
              {area.ciclo_fim ? (
                <p className="num text-sm text-texto-suave">
                  Sua mensalidade vale até {dia(area.ciclo_fim)}.
                </p>
              ) : null}
            </>
          ) : area.vencida ? (
            <>
              <p className="flex items-start gap-2 text-alerta">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span>
                  Sua mensalidade venceu
                  {area.proxima_cobranca ? ` em ${dia(area.proxima_cobranca)}` : ""}.
                  Até acertar, o corte sai no valor normal.
                </span>
              </p>
              <p className="num text-sm text-texto-suave">
                São {moedaCentavos(area.mensalidade)} no pix{" "}
                {telefoneBonito(barbearia.pix_key ?? "")}. Depois de pagar, avise
                o Johny que ele libera.
              </p>
            </>
          ) : (
            <p className="text-texto-medio">
              Você ainda não é do clube. Fale com o Johny: os planos começam em{" "}
              {moedaCentavos(barbearia.clube_preco_centavos)} por mês.
            </p>
          )}
        </section>

        {/* Só para quem é do clube: quem não assina não tem por que dar a
            data, e pedir mesmo assim seria coletar dado à toa. */}
        {area.assinante ? <Aniversario atual={area.nascimento} /> : null}

        <Link
          href="/agendar"
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-pill bg-acao px-6 font-titulo text-base font-bold text-acao-sobre transition-colors hover:bg-acao-hover"
        >
          <Scissors className="h-5 w-5" strokeWidth={2.5} />
          Marcar um horário
        </Link>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Seus próximos horários</h2>

          {area.proximos.length === 0 ? (
            <p className="rounded-card border border-borda bg-superficie px-4 py-8 text-center text-sm text-texto-suave">
              Nada marcado ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {area.proximos.map((m) => (
                <li
                  key={m.inicio}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-borda bg-superficie px-4 py-3"
                >
                  <CalendarCheck
                    className="h-5 w-5 shrink-0 text-acao"
                    strokeWidth={2.5}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-titulo text-sm font-semibold">
                      {m.servico} · {m.barbeiro}
                    </span>
                    <span className="num truncate text-xs text-texto-suave">
                      {quando(m.inicio)}
                    </span>
                  </div>

                  {m.status === "pendente_pagamento" ? (
                    <span className="num flex shrink-0 items-center gap-1.5 rounded-pill border border-alerta/50 px-3 py-1 text-xs text-alerta">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
                      falta o pix
                    </span>
                  ) : null}

                  {m.token ? (
                    <Desmarcar token={m.token} inicio={m.inicio} />
                  ) : null}

                  {m.token ? (
                    <Link
                      href={`/meu-agendamento/${m.token}`}
                      className="inline-flex min-h-toque shrink-0 items-center rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
                    >
                      Ver
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg">Seus cortes</h2>
            <span className="num text-sm text-texto-suave">
              {area.total_cortes} no total
            </span>
          </div>

          {area.historico.length === 0 ? (
            <p className="rounded-card border border-borda bg-superficie px-4 py-8 text-center text-sm text-texto-suave">
              Seu histórico aparece aqui depois do primeiro corte.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {area.historico.map((m) => (
                <li
                  key={m.inicio}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-card border border-borda bg-superficie-ativa px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {m.servico} · {m.barbeiro}
                    </span>
                    <span className="num truncate text-xs text-texto-suave">
                      {quando(m.inicio)}
                    </span>
                  </div>
                  <span className="num shrink-0 text-sm text-texto-suave">
                    {m.usou_clube && m.valor_centavos === 0
                      ? "pelo clube"
                      : moedaCentavos(m.valor_centavos)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          href="/"
          className="text-center text-sm text-texto-suave transition-colors hover:text-texto"
        >
          Voltar para o site
        </Link>
      </main>
    </div>
  );
}
