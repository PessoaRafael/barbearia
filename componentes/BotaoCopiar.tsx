"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

export function BotaoCopiar({
  valor,
  rotulo = "Copiar",
  destaque = false,
  className = "",
}: {
  valor: string;
  rotulo?: string;
  destaque?: boolean;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      const campo = document.createElement("textarea");
      campo.value = valor;
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      document.execCommand("copy");
      document.body.removeChild(campo);
    }
    setCopiado(true);
  }

  const base =
    "inline-flex min-h-toque items-center justify-center gap-2 rounded-pill px-4 font-titulo text-sm font-semibold transition-colors";
  const cor = destaque
    ? "bg-acao text-acao-sobre hover:bg-acao-hover"
    : "border border-borda-forte bg-superficie-ativa text-texto hover:border-acao";

  return (
    <button type="button" onClick={copiar} className={`${base} ${cor} ${className}`}>
      {copiado ? (
        <Check className="h-4 w-4" strokeWidth={2.5} />
      ) : (
        <Copy className="h-4 w-4" strokeWidth={2} />
      )}
      {copiado ? "Copiado" : rotulo}
    </button>
  );
}
