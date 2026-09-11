import Image from "next/image";
import { notFound } from "next/navigation";

import { Relogio } from "@/componentes/mural/Relogio";
import { agoraNaCasa, hojeNaCasa } from "@/lib/agenda/dias";
import { muralDoDia, type NoMural } from "@/lib/dados/mural";

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

  const dia = new Date(`${dados.dia}T12:00:00-03:00`).toLocaleDateString(
    "pt-BR",
    { timeZone: "America/Fortaleza", weekday: "long", day: "2-digit", month: "long" },
  );

  const total = dados.colunas.reduce((s, c) => s + c.marcados.length, 0);

  return (
    <div className="flex min-h-screen flex-col bg-fundo">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-5 py-4 sm:px-8">
        <div className="flex flex-col">
          <span className="font-titulo text-xl font-bold sm:text-2xl">
            {dados.casa}
          </span>
          <span className="text-sm capitalize text-texto-suave">{dia}</span>
        </div>
        <div className="flex items-center gap-5">
          <span className="num text-sm text-texto-suave">
            {total} {total === 1 ? "horário" : "horários"}
          </span>
          <Relogio dia={dados.dia} />
        </div>
      </header>

      <main className="grid flex-1 gap-px bg-borda sm:grid-cols-2 lg:grid-cols-3">
        {dados.colunas.map((c) => (
          <section key={c.barbeiroId} className="flex flex-col gap-3 bg-fundo p-4 sm:p-5">
            <div className="flex items-center gap-3 border-b border-borda pb-3">
              {/* O rosto vale mais que o nome numa tela lida de longe: o
                  barbeiro acha a própria coluna sem ler. */}
              {c.foto ? (
                <Image
                  src={c.foto}
                  alt={c.nome}
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0 rounded-pill border border-borda object-cover object-top"
                />
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-pill border border-borda bg-superficie-ativa font-titulo text-base font-bold text-texto-suave">
                  {c.nome.slice(0, 2).toUpperCase()}
                </span>
              )}

              <span className="font-titulo text-lg font-bold sm:text-xl">
                {c.nome}
              </span>
              <span className="num ml-auto text-sm text-texto-apagado">
                {c.marcados.length}
              </span>
            </div>

            {c.marcados.length === 0 ? (
              <p className="text-sm text-texto-apagado">Sem horário hoje.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {c.marcados.map((m) => (
                  <Linha key={m.id} marcado={m} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}

function Linha({ marcado }: { marcado: NoMural }) {
  /**
   * Comparação de hora com hora, em texto.
   *
   * `agoraNaCasa()` devolve "HH:MM" no fuso da barbearia, e é nesse formato
   * que as horas do mural já chegam. Converter para Date aqui reintroduziria o
   * fuso do servidor, que é justamente o que aquela função existe para evitar.
   */
  const agora = agoraNaCasa();
  const mesmoDia = marcado.inicio.slice(0, 10) === hojeNaCasa();

  const comecou = mesmoDia && marcado.hora <= agora;
  const terminou = mesmoDia && marcado.horaFim <= agora;

  /**
   * Na cadeira agora fica aceso, o que já passou apaga.
   *
   * O barbeiro olha de longe e de relance: se tudo tiver o mesmo peso, ele
   * precisa ler a hora de cada linha para achar a sua vez.
   */
  const naCadeira = comecou && !terminou && marcado.status !== "faltou";
  const passou = terminou || marcado.status === "concluido" || marcado.status === "faltou";

  return (
    <li
      className={`flex items-center gap-4 rounded-card border px-4 py-3 ${
        naCadeira
          ? "border-acao bg-acao/10"
          : passou
            ? "border-transparent opacity-40"
            : "border-borda bg-superficie"
      }`}
    >
      <span
        className={`num shrink-0 font-titulo text-2xl font-bold tabular-nums sm:text-3xl ${
          naCadeira ? "text-acao" : "text-texto"
        }`}
      >
        {marcado.hora}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-titulo text-lg font-semibold leading-tight sm:text-xl">
          {marcado.cliente}
        </span>
        <span className="truncate text-sm text-texto-suave">
          {marcado.servico}
        </span>
      </span>

      {marcado.status === "faltou" ? (
        <span className="shrink-0 font-titulo text-xs font-bold uppercase tracking-wide text-alerta">
          faltou
        </span>
      ) : marcado.clube ? (
        <span className="shrink-0 rounded-pill bg-clube px-2.5 py-1 font-titulo text-xs font-bold uppercase tracking-wide text-fundo">
          clube
        </span>
      ) : null}
    </li>
  );
}
