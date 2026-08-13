"use client";

import { useRouter } from "next/navigation";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Trocar de dia e salvar em PDF.
 *
 * "Baixar" é a impressão do navegador com destino "Salvar como PDF" — é o
 * único caminho que funciona igual no computador e no celular do Johny sem
 * depender de nada instalado no servidor. Todo este bloco some na impressão,
 * junto com o resto da navegação.
 */
export function Controles({ dia }: { dia: string }) {
  const router = useRouter();

  const mover = (passos: number) => {
    const d = new Date(`${dia}T12:00:00-03:00`);
    d.setDate(d.getDate() + passos);
    router.push(`/relatorio?dia=${d.toLocaleDateString("en-CA")}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={() => mover(-1)}
        aria-label="Dia anterior"
        className="grid h-11 w-11 place-items-center rounded-pill border border-borda text-texto-suave transition-colors hover:border-acao hover:text-acao"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2} />
      </button>

      <input
        type="date"
        value={dia}
        onChange={(e) => {
          if (e.target.value) router.push(`/relatorio?dia=${e.target.value}`);
        }}
        aria-label="Dia do relatório"
        className="num min-h-toque rounded-bloco border border-borda bg-superficie px-3 text-sm text-texto"
      />

      <button
        type="button"
        onClick={() => mover(1)}
        aria-label="Próximo dia"
        className="grid h-11 w-11 place-items-center rounded-pill border border-borda text-texto-suave transition-colors hover:border-acao hover:text-acao"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2} />
      </button>

      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex min-h-toque items-center gap-2 rounded-pill bg-acao px-5 font-titulo text-sm font-bold text-acao-sobre transition-colors hover:bg-acao-hover"
      >
        <Download className="h-4 w-4" strokeWidth={2.5} />
        Baixar PDF
      </button>
    </div>
  );
}
