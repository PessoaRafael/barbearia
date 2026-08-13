import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Controles } from "@/componentes/relatorio/Controles";
import { hojeNaCasa } from "@/lib/agenda/dias";
import { lerSessao } from "@/lib/auth/sessao";
import { moedaCentavos } from "@/lib/formato";
import { relatorioDoDia } from "@/lib/dados/relatorio";

export const dynamic = "force-dynamic";

/**
 * Fechamento do dia, feito para virar papel.
 *
 * Fica fora de /painel de propósito: o layout de lá traz cabeçalho e barra
 * lateral, e isso sairia impresso junto. Aqui a página é só o relatório, e o
 * "Baixar PDF" é a impressão do navegador com destino "Salvar como PDF" —
 * funciona igual no computador e no celular, sem depender de nada no servidor.
 */
export default async function RelatorioDoDia({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/entrar");
  if (sessao.papel !== "owner") redirect("/entrar");

  const { dia = hojeNaCasa() } = await searchParams;
  const r = await relatorioDoDia(
    { chaveId: sessao.chaveId, barbeariaId: sessao.barbeariaId },
    dia,
  );

  const porExtenso = new Date(`${dia}T12:00:00-03:00`).toLocaleDateString(
    "pt-BR",
    {
      timeZone: "America/Fortaleza",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6 sm:px-8 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/painel"
          className="inline-flex min-h-toque items-center gap-2 font-titulo text-sm font-semibold text-texto-suave hover:text-texto"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Voltar ao painel
        </Link>
        <Controles dia={dia} />
      </div>

      <header className="flex flex-col gap-1 border-b border-borda pb-4">
        <h1 className="text-2xl">{sessao.casa.nome}</h1>
        <p className="text-sm text-texto-suave">
          Fechamento de <span className="first-letter:uppercase">{porExtenso}</span>
        </p>
      </header>

      {/* O número que o Johny procura primeiro. */}
      <section className="flex flex-col gap-3 rounded-grande border border-borda bg-superficie p-5">
        <span className="text-xs uppercase tracking-wide text-texto-apagado">
          Total do dia
        </span>
        <span className="num font-titulo text-4xl font-bold text-acao">
          {moedaCentavos(r.totalDoDia)}
        </span>
        <p className="text-xs text-texto-suave">
          {moedaCentavos(r.avulso.recebido)} recebido no dia
          {" + "}
          {moedaCentavos(r.clube.porDia)} da parte diária das mensalidades
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Atendimentos</h2>
        <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Numero rotulo="Marcados" valor={r.atendimentos.total} />
          <Numero rotulo="Concluídos" valor={r.atendimentos.concluidos} />
          <Numero rotulo="Confirmados" valor={r.atendimentos.confirmados} />
          <Numero rotulo="Esperando pix" valor={r.atendimentos.pendentes} />
          <Numero rotulo="Cancelados" valor={r.atendimentos.cancelados} />
          <Numero rotulo="Faltas" valor={r.atendimentos.faltas} />
        </dl>

        {r.porBarbeiro.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-apagado">
                <th className="py-2 font-normal">Barbeiro</th>
                <th className="py-2 text-right font-normal">Cortes</th>
                <th className="py-2 text-right font-normal">Em serviço</th>
              </tr>
            </thead>
            <tbody>
              {r.porBarbeiro.map((b) => (
                <tr key={b.nome} className="border-b border-borda/60">
                  <td className="py-2">{b.nome}</td>
                  <td className="num py-2 text-right">{b.cortes}</td>
                  <td className="num py-2 text-right">
                    {moedaCentavos(b.centavos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Avulsos</h2>

        {r.avulso.linhas.length === 0 ? (
          <p className="text-sm text-texto-suave">
            Nenhum atendimento avulso neste dia.
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-apagado">
                  <th className="py-2 font-normal">Hora</th>
                  <th className="py-2 font-normal">Cliente</th>
                  <th className="py-2 font-normal">Serviço</th>
                  <th className="py-2 text-right font-normal">Valor</th>
                  <th className="py-2 text-right font-normal">Pago</th>
                </tr>
              </thead>
              <tbody>
                {r.avulso.linhas.map((l, i) => (
                  <tr key={`${l.hora}-${i}`} className="border-b border-borda/60">
                    <td className="num py-2">{l.hora}</td>
                    <td className="py-2">{l.cliente}</td>
                    <td className="py-2 text-texto-suave">{l.servico}</td>
                    <td className="num py-2 text-right">
                      {moedaCentavos(l.centavos)}
                    </td>
                    <td className="py-2 text-right">{l.pago ? "sim" : "não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                Recebido:{" "}
                <span className="num font-titulo font-bold text-acao">
                  {moedaCentavos(r.avulso.recebido)}
                </span>
              </span>
              {r.avulso.aReceber > 0 ? (
                <span>
                  Ainda a receber:{" "}
                  <span className="num font-titulo font-bold text-alerta">
                    {moedaCentavos(r.avulso.aReceber)}
                  </span>
                </span>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Clube</h2>

        <p className="text-sm text-texto-suave">
          Corte de assinante sai R$ 0 na hora porque já foi pago na
          mensalidade. Abaixo, o que o clube representa por dia.
        </p>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Numero rotulo="Cortes hoje" valor={r.clube.cortesNoDia} />
          <Numero rotulo="Assinantes" valor={r.clube.assinantes} />
          <Numero
            rotulo="Mensalidades"
            valor={moedaCentavos(r.clube.mensalSomado)}
          />
          <Numero rotulo="Por dia" valor={moedaCentavos(r.clube.porDia)} />
        </dl>

        {r.clube.porPlano.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-apagado">
                <th className="py-2 font-normal">Plano</th>
                <th className="py-2 text-right font-normal">Assinantes</th>
                <th className="py-2 text-right font-normal">Por ciclo</th>
              </tr>
            </thead>
            <tbody>
              {r.clube.porPlano.map((p) => (
                <tr key={p.nome} className="border-b border-borda/60">
                  <td className="py-2">{p.nome}</td>
                  <td className="num py-2 text-right">{p.quantos}</td>
                  <td className="num py-2 text-right">
                    {moedaCentavos(p.centavos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {r.clube.cortesNoDia > 0 ? (
          <p className="text-xs text-texto-suave">
            Os {r.clube.cortesNoDia} cortes de clube de hoje custariam{" "}
            <span className="num">{moedaCentavos(r.clube.valorDeTabela)}</span>{" "}
            na tabela.
          </p>
        ) : null}
      </section>

      {r.caixa.entradas > 0 || r.caixa.saidas > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg">Caixa</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              Entradas:{" "}
              <span className="num font-titulo font-bold text-acao">
                {moedaCentavos(r.caixa.entradas)}
              </span>
            </span>
            <span>
              Saídas:{" "}
              <span className="num font-titulo font-bold text-alerta">
                {moedaCentavos(r.caixa.saidas)}
              </span>
            </span>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-borda pt-3 text-xs text-texto-apagado">
        Gerado pelo sistema da {sessao.casa.nome}. A parte diária das
        mensalidades é o valor do plano dividido pelos dias do ciclo — não é
        dinheiro que caiu hoje, é quanto o clube vale por dia.
      </footer>
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-borda bg-superficie px-3 py-2">
      <dt className="text-xs text-texto-suave">{rotulo}</dt>
      <dd className="num font-titulo text-lg font-bold text-texto">{valor}</dd>
    </div>
  );
}
