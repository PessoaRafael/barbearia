import { Camera } from "lucide-react";

/** Placeholder quadrado arredondado com o monograma da casa. */
export function Logo({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-bloco border border-borda-forte bg-superficie-ativa font-titulo font-bold leading-none text-acao"
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.max(13, Math.round(tamanho * 0.34)),
        borderRadius: Math.max(12, Math.round(tamanho * 0.28)),
      }}
      aria-hidden
    >
      JB
    </span>
  );
}

/** Área reservada para foto. Nada de imagem externa. */
export function Retrato({
  iniciais,
  proporcao = "1 / 1",
  legenda,
  className = "",
}: {
  iniciais?: string;
  proporcao?: string;
  legenda?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-card border border-borda bg-superficie-ativa ${className}`}
      style={{ aspectRatio: proporcao }}
    >
      {iniciais ? (
        <span className="font-titulo text-3xl font-bold text-texto-apagado">
          {iniciais}
        </span>
      ) : (
        <Camera className="h-6 w-6 text-texto-apagado" strokeWidth={1.5} />
      )}
      {legenda ? (
        <span className="absolute bottom-2 left-3 text-xs text-texto-apagado">
          {legenda}
        </span>
      ) : null}
    </div>
  );
}

/** Etiqueta discreta: "mais pedido", "clube cobre o corte". */
export function Etiqueta({
  children,
  tom = "neutro",
}: {
  children: React.ReactNode;
  tom?: "neutro" | "clube" | "acao" | "alerta";
}) {
  const tons = {
    neutro: "border-borda text-texto-suave",
    clube: "border-clube/40 text-clube",
    acao: "border-acao/50 text-acao",
    alerta: "border-alerta/50 text-alerta",
  };
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs ${tons[tom]}`}
    >
      {children}
    </span>
  );
}

export function Secao({
  titulo,
  apoio,
  children,
  id,
}: {
  titulo: string;
  apoio?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="flex flex-col gap-5 scroll-mt-20">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl sm:text-3xl">{titulo}</h2>
        {apoio ? <p className="text-texto-suave">{apoio}</p> : null}
      </div>
      {children}
    </section>
  );
}
