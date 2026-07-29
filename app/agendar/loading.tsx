import { Logo } from "@/componentes/base";

/** Esqueleto dos passos, para o toque nunca parecer que não pegou. */
export default function Carregando() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-borda px-5 py-3 sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <Logo tamanho={36} />
          <span className="font-titulo text-base font-bold">
            Johny Barbearia
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 pt-6 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl">Agendar horário</h1>
          <span className="h-5 w-64 animate-pulse rounded-pill bg-superficie" />
        </div>

        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="h-16 animate-pulse rounded-grande border border-borda bg-superficie"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
