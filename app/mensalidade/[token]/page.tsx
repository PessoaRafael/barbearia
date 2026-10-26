import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Crown, Loader2, TriangleAlert } from "lucide-react";

import { Logo } from "@/componentes/base";
import { PagarMensalidade } from "@/componentes/clube/PagarMensalidade";
import { clienteDoToken } from "@/lib/clube/link";
import { mensalidadeDe } from "@/lib/clube/mensalidade";
import { casa } from "@/lib/dados/casa";
import { moedaCentavos, telefoneBonito } from "@/lib/formato";
import {
  confirmarPelaInfinitepay,
  infinitepayLigado,
  lerVolta,
} from "@/lib/payments/infinitepay";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * A mensalidade de um assinante, para pagar sem falar com ninguém.
 *
 * É o link que vai na cobrança do WhatsApp. Antes a mensagem levava a chave
 * pix, o assinante pagava e esperava o Johny conferir o extrato e tocar em
 * "Renovar", com uns cinquenta vencendo na mesma semana. Aqui ele paga na
 * InfinitePay e o clube volta a valer na hora.
 */
export const dynamic = "force-dynamic";

const dia = (d: string) =>
  new Date(`${d}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
  });

export default async function PaginaDaMensalidade({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ token }, busca] = await Promise.all([params, searchParams]);

  const clienteId = clienteDoToken(token);
  if (!clienteId) notFound();

  /**
   * Volta da InfinitePay: confere e libera aqui mesmo, sem esperar o aviso
   * dela, que pode chegar depois do navegador. Quem chegar em segundo sai
   * sem fazer nada.
   */
  const volta = lerVolta(busca);
  let voltou: "paga" | "esperando" | null = null;
  if (volta?.pedido.startsWith("IC")) {
    await confirmarPelaInfinitepay(volta).catch((erro) =>
      console.error("infinitepay mensalidade na volta:", (erro as Error).message),
    );

    // Só conta como "pago" o pedido deste cliente: o link é dele, o pedido
    // da URL pode ser de qualquer um.
    const { data: pedido } = await clienteServico()
      .from("cobrancas_do_clube")
      .select("status")
      .eq("pedido", volta.pedido)
      .eq("client_id", clienteId)
      .maybeSingle();
    if (pedido) voltou = pedido.status === "paga" ? "paga" : "esperando";
  }

  const [m, barbearia] = await Promise.all([mensalidadeDe(clienteId), casa()]);
  if (!m) notFound();

  const online = infinitepayLigado() && Boolean(m.plano);
  const valor = m.plano ? moedaCentavos(m.plano.precoCentavos) : "";
  const emDia = m.assinatura?.emDia ?? false;

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
        {voltou === "paga" ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-card border border-clube/50 bg-superficie px-4 py-3"
          >
            <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-clube" strokeWidth={2} />
            <span className="text-sm text-texto">
              Pagamento aprovado. Seu clube já está valendo
              {m.assinatura ? ` até ${dia(m.assinatura.ate)}` : ""}.
            </span>
          </div>
        ) : voltou === "esperando" ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-card border border-borda bg-superficie px-4 py-3"
          >
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 text-texto-suave" strokeWidth={2} />
            <span className="text-sm text-texto-suave">
              O pagamento ainda não apareceu aqui. Se você pagou, ele confirma
              sozinho em instantes:{" "}
              <a href={`/mensalidade/${token}?${new URLSearchParams(busca as Record<string, string>)}`} className="font-semibold text-texto underline underline-offset-4">
                conferir de novo
              </a>
              .
            </span>
          </div>
        ) : null}

        <section
          className={`flex flex-col gap-3 rounded-grande border bg-superficie p-5 ${
            emDia ? "border-clube/40" : m.assinatura ? "border-alerta/50" : "border-borda"
          }`}
        >
          <div className="flex items-center gap-2">
            <Crown
              className={`h-5 w-5 shrink-0 ${emDia ? "text-clube" : "text-texto-suave"}`}
              strokeWidth={2.5}
            />
            <span className="font-titulo text-lg font-bold">
              {m.plano?.nome ?? "Clube Johny"}
            </span>
          </div>

          <p className="text-texto-medio">
            {m.nome.split(" ")[0]},{" "}
            {!m.assinatura
              ? `falta pagar a primeira mensalidade para entrar no clube.`
              : emDia
                ? `sua mensalidade está em dia até ${dia(m.assinatura.ate)}.`
                : `sua mensalidade venceu em ${dia(m.assinatura.ate)}. Até pagar, o corte sai no valor normal.`}
          </p>

          {online ? (
            <>
              <PagarMensalidade
                token={token}
                rotulo={
                  emDia ? `Adiantar o próximo mês · ${valor}` : `Pagar ${valor} no pix ou cartão`
                }
                destaque={!emDia}
              />
              <p className="text-xs text-texto-suave">
                {emDia
                  ? `Pagando agora, o mês novo começa em ${dia(m.assinatura!.ate)}: você não perde os dias que já pagou.`
                  : "Abre a página segura da InfinitePay. Assim que o pagamento passa, o clube volta a valer sozinho, sem precisar avisar ninguém."}
              </p>
            </>
          ) : m.plano ? (
            <p className="num text-sm text-texto-suave">
              São {valor} no pix {telefoneBonito(barbearia.pix_key ?? "")}. Depois
              de pagar, avise o Johny que ele libera.
            </p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-alerta">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              Não achei o seu plano. Chame o Johny
              {barbearia.telefone ? ` no ${barbearia.telefone}` : ""}.
            </p>
          )}
        </section>

        <Link
          href="/agendar"
          className="inline-flex min-h-toque items-center justify-center rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
        >
          Marcar um horário
        </Link>

        <p className="text-xs text-texto-apagado">
          Este link é seu e vale todo mês. Guarde para pagar as próximas.
        </p>
      </main>
    </div>
  );
}
