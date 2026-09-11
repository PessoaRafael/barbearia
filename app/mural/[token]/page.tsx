import { notFound } from "next/navigation";

import { Colunas, type Coluna } from "@/componentes/mural/Colunas";
import { Relogio } from "@/componentes/mural/Relogio";
import { agoraNaCasa, hojeNaCasa } from "@/lib/agenda/dias";
import { muralDoDia } from "@/lib/dados/mural";

/**
 * O mural da bancada.
 *
 * Uma coluna por barbeiro, os horários do dia, e nada mais. Sem preço, sem
 * caixa, sem telefone: o tablet fica à vista de quem espera, e o que não é
 * lido aqui não vaza por cima do balcão.
 *
 * O endereço tem o token dentro justamente para não exigir login — ninguém vai
 * desbloquear celular no meio do corte — e para não dar acesso a mais nada:
 * quem pegar o tablet não chega no painel.
 */
export const dynamic = "force-dynamic";

export default async function Mural({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const dados = await muralDoDia(token);
  if (!dados) notFound();

  /**
   * Quem está na cadeira agora é decidido aqui, no fuso da casa.
   *
   * `agoraNaCasa()` devolve "HH:MM", e é nesse formato que as horas já chegam
   * — comparar texto com texto evita reintroduzir o fuso do servidor, que é
   * justamente o que aquela função existe para resolver.
   */
  const agora = agoraNaCasa();
  const ehHoje = dados.dia === hojeNaCasa();

  const colunas: Coluna[] = dados.colunas.map((c) => ({
    barbeiroId: c.barbeiroId,
    nome: c.nome,
    foto: c.foto,
    marcados: c.marcados.map((m) => {
      const comecou = ehHoje && m.hora <= agora;
      const terminou = ehHoje && m.horaFim <= agora;

      return {
        id: m.id,
        hora: m.hora,
        cliente: m.cliente,
        servico: m.servico,
        status: m.status,
        clube: m.clube,
        naCadeira: comecou && !terminou && m.status !== "faltou",
        passou:
          terminou || m.status === "concluido" || m.status === "faltou",
      };
    }),
  }));

  const dia = new Date(`${dados.dia}T12:00:00-03:00`).toLocaleDateString(
    "pt-BR",
    { timeZone: "America/Fortaleza", weekday: "long", day: "2-digit", month: "long" },
  );

  const total = colunas.reduce((s, c) => s + c.marcados.length, 0);

  return (
    <div className="flex min-h-screen flex-col bg-fundo">
      {/* No celular o cabeçalho vira uma linha só: nome e relógio. A data
          inteira e a contagem comem a altura que a lista precisa. */}
      <header className="flex items-center justify-between gap-3 border-b border-borda px-4 py-3 sm:px-8 sm:py-4">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-titulo text-base font-bold sm:text-2xl">
            {dados.casa}
          </span>
          <span className="hidden text-sm capitalize text-texto-suave sm:block">
            {dia}
          </span>
          <span className="num text-xs text-texto-apagado sm:hidden">
            {total} {total === 1 ? "horário" : "horários"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-5">
          <span className="num hidden text-sm text-texto-suave sm:block">
            {total} {total === 1 ? "horário" : "horários"}
          </span>
          <Relogio dia={dados.dia} />
        </div>
      </header>

      <main className="flex-1">
        <Colunas colunas={colunas} />
      </main>
    </div>
  );
}
