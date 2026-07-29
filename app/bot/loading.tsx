import { Logo } from "@/componentes/base";

/**
 * Esqueleto do chat enquanto a página carrega. Aparece na hora do clique, com
 * a mesma moldura da conversa, para o toque nunca parecer que não pegou.
 */
export default function Carregando() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-borda px-5 py-3 sm:px-8">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <Logo tamanho={36} />
          <div className="flex flex-col gap-1">
            <span className="font-titulo text-base font-bold leading-tight">
              Marcar pelo chat
            </span>
            <span className="flex items-center gap-1.5 text-xs text-texto-suave">
              <span className="h-1.5 w-1.5 rounded-pill bg-texto-apagado" />
              abrindo
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-5 py-6 sm:px-8">
        <div className="flex justify-start">
          <span className="h-12 w-2/3 animate-pulse rounded-grande border border-borda bg-superficie" />
        </div>
        <div className="flex justify-start">
          <span className="h-20 w-5/6 animate-pulse rounded-grande border border-borda bg-superficie" />
        </div>
      </main>
    </div>
  );
}
