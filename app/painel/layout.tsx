import { redirect } from "next/navigation";

import { Logo } from "@/componentes/base";
import { BarraLateral } from "@/componentes/painel/BarraLateral";
import { sair } from "@/app/entrar/acoes";
import { lerSessao } from "@/lib/auth/sessao";
import { novosNaAgenda, pixParaConferir } from "@/lib/dados/painel";

/**
 * A casca do painel: cabeçalho e barra lateral.
 *
 * Estar no layout é o ponto. Trocar de aba mexe só na página, então o
 * navegador reaproveita esta parte em vez de pedir tudo de novo ao servidor a
 * cada clique, que era o que dava a sensação de lentidão na barra lateral.
 */
export default async function LayoutDoPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/entrar");
  if (sessao.papel === "barber") redirect("/agenda");
  if (sessao.papel === "client") redirect("/clube");

  const barbearia = sessao.casa;
  const escopo = {
    chaveId: sessao.chaveId,
    barbeariaId: sessao.barbeariaId,
  };

  const [pendentes, novos] = await Promise.all([
    pixParaConferir(escopo),
    novosNaAgenda(escopo),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-5 py-3 sm:px-8 lg:px-10">
          <Logo tamanho={36} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-titulo text-base font-bold leading-tight">
              {barbearia.nome}
            </span>
            <span className="truncate text-xs text-texto-suave">
              painel do Johny
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

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-start lg:gap-6 lg:px-10">
        <BarraLateral pendentes={pendentes.length} novos={novos.quantos} />

        <main className="flex min-w-0 flex-1 flex-col gap-5">{children}</main>
      </div>
    </div>
  );
}
