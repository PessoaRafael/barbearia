"use client";

import { useEffect, useState } from "react";

import { estadoDaCasa, type EstadoDaCasa } from "@/lib/casa";

/**
 * "Aberto agora · até 18:30", no alto da página.
 *
 * É a primeira pergunta de quem chega no site pelo Instagram no meio da tarde,
 * e antes a resposta estava no rodapé, numa tabela de quatro linhas que exige
 * o visitante saber que dia é hoje e fazer a conta.
 *
 * O servidor manda a resposta já montada para não haver buraco na primeira
 * pintura; o navegador refaz a conta ao montar e de minuto em minuto. Sem essa
 * segunda conta, os dez minutos de cache da página deixariam "aberto" na tela
 * depois de a casa ter fechado.
 */

const FUSO = "America/Fortaleza";
const SIGLAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function aquiEAgora(): EstadoDaCasa {
  const d = new Date();
  const dia = SIGLAS.indexOf(
    new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short" }).format(d),
  );
  const hora = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

  return estadoDaCasa(dia, hora);
}

export function EstaAberto({ inicial }: { inicial: EstadoDaCasa }) {
  const [estado, setEstado] = useState(inicial);

  useEffect(() => {
    const conferir = () => setEstado(aquiEAgora());
    conferir();
    const relogio = setInterval(conferir, 60_000);
    return () => clearInterval(relogio);
  }, []);

  return (
    <span className="inline-flex items-center gap-2 self-start rounded-pill border border-borda bg-superficie/80 py-1.5 pl-2.5 pr-4 text-sm">
      <span className="relative grid h-2.5 w-2.5 shrink-0 place-items-center">
        {/* O halo só pulsa quando está aberto: bolinha piscando em cima de
            "fechado" vira alarme, e não é urgência nenhuma. */}
        {estado.aberto ? (
          <span className="absolute h-2.5 w-2.5 animate-ping rounded-pill bg-clube/60" />
        ) : null}
        <span
          className={`h-2 w-2 rounded-pill ${
            estado.aberto ? "bg-clube" : "bg-texto-apagado"
          }`}
        />
      </span>
      <span className="font-titulo font-semibold text-texto">{estado.texto}</span>
      {estado.detalhe ? (
        <span className="num text-texto-suave">{estado.detalhe}</span>
      ) : null}
    </span>
  );
}
