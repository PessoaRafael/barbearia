import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, CalendarX2, Timer, XCircle } from "lucide-react";

import { Logo } from "@/componentes/base";
import { PainelPix } from "@/componentes/agendar/PainelPix";
import { casa } from "@/lib/dados/casa";
import { moedaCentavos } from "@/lib/formato";
import { duracaoLabel } from "@/componentes/agendar/tipos";
import { HORAS_LIMITE_CANCELAMENTO } from "@/lib/regras";
import { buscarAgendamento } from "./acoes";
import { BotaoCancelar } from "./BotaoCancelar";

export const dynamic = "force-dynamic";

const APARENCIA: Record<
  string,
  { titulo: string; texto: string; tom: "acao" | "alerta" | "apagado" }
> = {
  confirmado: {
    titulo: "Horário marcado",
    texto: "Te esperamos na cadeira.",
    tom: "acao",
  },
  pendente_pagamento: {
    titulo: "Reservado, aguardando o pix cair",
    texto: "A cadeira está no seu nome. O barbeiro confirma quando o pix cair.",
    tom: "alerta",
  },
  concluido: {
    titulo: "Corte concluído",
    texto: "Valeu pela visita. Quando quiser voltar, é só marcar.",
    tom: "acao",
  },
  cancelado: {
    titulo: "Agendamento cancelado",
    texto: "Esse horário voltou para a agenda.",
    tom: "apagado",
  },
  expirado: {
    titulo: "A reserva expirou",
    texto: "O pix não caiu no prazo e o horário voltou para a agenda.",
    tom: "apagado",
  },
  faltou: {
    titulo: "Você não apareceu",
    texto: "Se foi engano, fale com a barbearia.",
    tom: "alerta",
  },
};

export default async function MeuAgendamento({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [agendamento, barbearia] = await Promise.all([
    buscarAgendamento(token),
    casa(),
  ]);

  if (!agendamento) notFound();

  const visual = APARENCIA[agendamento.status] ?? APARENCIA.confirmado;
  const inicio = new Date(agendamento.inicio);

  const quando = inicio.toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const hora = inicio.toLocaleTimeString("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
  });

  const aguardando = agendamento.status === "pendente_pagamento";
  const encerrado = ["cancelado", "expirado"].includes(agendamento.status);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-borda">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-3 sm:px-8">
          <Logo tamanho={36} />
          <span className="truncate font-titulo text-base font-bold">
            {barbearia.nome}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 py-8 sm:px-8">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-pill border ${
              visual.tom === "acao"
                ? "border-acao/50 text-acao"
                : visual.tom === "alerta"
                  ? "border-alerta/50 text-alerta"
                  : "border-borda text-texto-apagado"
            }`}
          >
            {encerrado ? (
              <CalendarX2 className="h-5 w-5" strokeWidth={2} />
            ) : aguardando ? (
              <Timer className="h-5 w-5" strokeWidth={2} />
            ) : (
              <CalendarCheck className="h-5 w-5" strokeWidth={2} />
            )}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl">{visual.titulo}</h1>
            <p className="text-sm text-texto-suave">{visual.texto}</p>
          </div>
        </div>

        <dl className="flex flex-col gap-3 rounded-grande border border-borda bg-superficie p-4 sm:p-5">
          <Linha rotulo="Quando" valor={`${quando}, às ${hora}`} />
          <Linha
            rotulo="Serviço"
            valor={`${agendamento.servico} · ${duracaoLabel(agendamento.duracaoMin)}`}
          />
          <Linha rotulo="Quem corta" valor={agendamento.barbeiro} />
          <Linha rotulo="No nome de" valor={agendamento.cliente} />

          <div className="flex items-baseline justify-between gap-4 border-t border-borda pt-3">
            <dt className="text-sm text-texto-suave">
              {agendamento.usouCredito ? "Com crédito do clube" : "Total"}
            </dt>
            <dd className="num font-titulo text-xl font-bold text-acao">
              {moedaCentavos(agendamento.valorCentavos)}
            </dd>
          </div>
        </dl>

        {aguardando && agendamento.pix?.status === "aguardando" ? (
          <PainelPix
            brcode={agendamento.pix.brcode}
            chave={barbearia.pix_key ?? ""}
            titular={barbearia.pix_titular ?? barbearia.nome}
            valor={moedaCentavos(agendamento.valorCentavos)}
            minutos={barbearia.reserva_minutos}
          />
        ) : null}

        {agendamento.podeCancelar ? (
          <BotaoCancelar token={token} />
        ) : !encerrado && agendamento.status !== "concluido" ? (
          <p className="flex items-start gap-2 rounded-card border border-borda bg-superficie px-4 py-3 text-sm text-texto-suave">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            <span>
              Falta menos de {HORAS_LIMITE_CANCELAMENTO} horas para o seu
              horário. Para
              cancelar agora, fale direto com a barbearia
              {barbearia.telefone ? ` no ${barbearia.telefone}` : ""}.
            </span>
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/agendar"
            className="inline-flex min-h-toque items-center justify-center rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
          >
            Marcar outro horário
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-toque items-center justify-center rounded-pill px-5 font-titulo text-sm font-semibold text-texto-suave transition-colors hover:text-texto"
          >
            Voltar para o início
          </Link>
        </div>

        <p className="text-xs text-texto-apagado">
          Guarde este link: é por ele que você acompanha e cancela, sem app e sem
          senha.
        </p>
      </main>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-sm text-texto-suave">{rotulo}</dt>
      <dd className="truncate text-right text-sm font-medium capitalize text-texto">
        {valor}
      </dd>
    </div>
  );
}
