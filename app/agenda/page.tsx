import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/componentes/base";
import { EncerrarAtendimento, SoltarBloqueio } from "@/componentes/painel/Acoes";
import { Bloquear } from "@/componentes/painel/Bloquear";
import { sair } from "@/app/entrar/acoes";
import { lerSessao } from "@/lib/auth/sessao";
import {
  agoraNaCasa,
  hojeNaCasa,
  proximosDias,
  rotuloDe,
} from "@/lib/agenda/dias";
import { painelAgenda, resumoDoDia } from "@/lib/dados/painel";
import { comecoDoResto } from "@/lib/agenda/fechar";
import { moedaCentavos, telefoneBonito } from "@/lib/formato";

/**
 * Painel do barbeiro: só a agenda dele.
 *
 * Não é a tela que esconde os outros, é o banco. agenda_do_dia deriva o
 * barbeiro da chave de acesso e ignora qualquer id que chegue junto.
 */
export const dynamic = "force-dynamic";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function AgendaDoBarbeiro({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/entrar");
  if (sessao.papel === "owner") redirect("/painel");
  if (sessao.papel === "client") redirect("/clube");

  const { dia = hojeNaCasa() } = await searchParams;
  const dias = proximosDias(7);

  const barbearia = sessao.casa;
  const escopo = {
    chaveId: sessao.chaveId,
    barbeariaId: sessao.barbeariaId,
  };

  const [{ marcados, bloqueios, janela }, resumo] = await Promise.all([
    painelAgenda(escopo, dia),
    resumoDoDia(escopo, dia),
  ]);

  const pontuais = bloqueios.filter((b) => b.motivo !== "almoço");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 py-3 sm:px-8">
          <Logo tamanho={36} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-titulo text-base font-bold leading-tight">
              {sessao.nome}
            </span>
            <span className="truncate text-xs text-texto-suave">
              sua agenda em {barbearia.nome}
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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6 sm:px-8">
        <dl className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="flex flex-col gap-1 rounded-card border border-borda bg-superficie px-4 py-3">
            <dt className="text-xs text-texto-suave">Seus atendimentos</dt>
            <dd className="num font-titulo text-2xl font-bold">
              {resumo.marcados}
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-card border border-borda bg-superficie px-4 py-3">
            <dt className="text-xs text-texto-suave">Você gerou</dt>
            <dd className="num font-titulo text-2xl font-bold text-acao">
              {moedaCentavos(resumo.receita_centavos)}
            </dd>
          </div>
        </dl>

        <div className="trilho -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          {dias.map((d) => {
            const ativo = d.data === dia;
            return (
              <Link
                key={d.data}
                href={`/agenda?dia=${d.data}`}
                className={`inline-flex min-h-toque shrink-0 items-center rounded-pill border px-4 font-titulo text-sm font-semibold transition-colors ${
                  ativo
                    ? "border-acao bg-acao text-acao-sobre"
                    : d.fechado
                      ? "border-borda bg-superficie-apagada text-texto-apagado"
                      : "border-borda bg-superficie-ativa text-texto-suave hover:border-borda-forte"
                }`}
              >
                {rotuloDe(d)}
              </Link>
            );
          })}
        </div>

        <Bloquear
          data={dia}
          janela={janela}
          apartirDe={comecoDoResto(janela, dia, hojeNaCasa(), agoraNaCasa())}
        />

        {pontuais.length ? (
          <ul className="flex flex-col gap-2">
            {pontuais.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-3 rounded-card border border-borda-forte bg-superficie-apagada px-4 py-3"
              >
                <span className="num font-titulo text-sm font-bold">
                  {b.inicio.slice(0, 5)}–{b.fim.slice(0, 5)}
                </span>
                <span className="flex-1 text-sm text-texto-suave">
                  {b.motivo ?? "bloqueado"}
                </span>
                <SoltarBloqueio bloqueioId={b.id} />
              </li>
            ))}
          </ul>
        ) : null}

        {marcados.length === 0 ? (
          <p className="rounded-card border border-borda bg-superficie px-4 py-12 text-center text-sm text-texto-suave">
            Nada marcado com você nesse dia.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {marcados.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-borda bg-superficie px-4 py-3"
              >
                <span className="num shrink-0 font-titulo text-lg font-bold">
                  {hora(m.inicio)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 truncate font-titulo text-sm font-semibold">
                    {m.servico}
                    {m.assinante ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-pill bg-acao"
                        title="assinante do clube"
                      />
                    ) : null}
                  </span>
                  <span className="truncate text-xs text-texto-suave">
                    {m.cliente} · {telefoneBonito(m.telefone)}
                  </span>
                </div>
                {m.status === "confirmado" ? (
                  <EncerrarAtendimento agendamentoId={m.id} />
                ) : (
                  <span className="shrink-0 text-xs text-texto-apagado">
                    {m.status === "pendente_pagamento" ? "aguardando pix" : m.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-texto-apagado">
          Você vê e mexe só na sua agenda. Preço, clube e números da casa ficam
          com o Johny.
        </p>
      </main>
    </div>
  );
}
