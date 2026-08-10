import Image from "next/image";
import { Camera } from "lucide-react";

/** Marca da casa: public/logo.jpg recortada em quadrado arredondado. */
export function Logo({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <span
      className="block shrink-0 border border-borda-forte bg-superficie-ativa bg-cover bg-center"
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: Math.max(12, Math.round(tamanho * 0.28)),
        backgroundImage: "url(/logo.jpg)",
      }}
      role="img"
      aria-label="Johny Barbearia"
    />
  );
}

/** Foto, quando existe. Sem `src`, vira área reservada. */
export function Retrato({
  src,
  alt,
  tamanhos = "100vw",
  iniciais,
  proporcao = "1 / 1",
  legenda,
  className = "",
}: {
  src?: string;
  alt?: string;
  tamanhos?: string;
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
      {src ? (
        <Image
          src={src}
          alt={alt ?? ""}
          fill
          sizes={tamanhos}
          /* Ancorado no topo: quando o box é mais quadrado que a foto, cortar
             pelo meio comeria a cabeça de quem está posando. */
          className="object-cover object-top"
          priority
        />
      ) : iniciais ? (
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
