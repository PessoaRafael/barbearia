"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * O relógio e a atualização sozinha do mural.
 *
 * O tablet fica aberto o dia inteiro sem ninguém tocar, então a tela precisa
 * se virar: puxa dado novo de minuto em minuto e redesenha a hora para o
 * "agora" não ficar mentindo.
 *
 * Um minuto é o passo da agenda — encaixe menor que isso não existe. Mais
 * rápido só gastaria bateria e rede o dia todo.
 */
export function Relogio({ dia }: { dia: string }) {
  const router = useRouter();
  const [agora, setAgora] = useState<string | null>(null);

  useEffect(() => {
    const bater = () =>
      setAgora(
        new Date().toLocaleTimeString("pt-BR", {
          timeZone: "America/Fortaleza",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );

    bater();
    const relogio = setInterval(() => {
      bater();
      router.refresh();
    }, 60_000);

    return () => clearInterval(relogio);
  }, [router, dia]);

  return (
    <span className="num font-titulo text-2xl font-bold tabular-nums text-acao sm:text-4xl">
      {agora ?? "--:--"}
    </span>
  );
}
