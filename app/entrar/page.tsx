"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { KeyRound, TriangleAlert } from "lucide-react";

import { Logo } from "@/componentes/base";
import { entrar } from "./acoes";

/** Máscara JHNY-XXXX-XXXX enquanto digita, sem brigar com quem cola a chave. */
function mascarar(bruto: string) {
  const limpo = bruto
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^JHNY/, "")
    .slice(0, 8);

  if (!limpo) return "";
  if (limpo.length <= 4) return `JHNY-${limpo}`;
  return `JHNY-${limpo.slice(0, 4)}-${limpo.slice(4)}`;
}

/**
 * A chave pode vir no link: /entrar?c=JHNY-XXXX-XXXX
 *
 * É o que o Johny manda no WhatsApp. O cliente toca e entra, sem decorar nem
 * digitar nada — e continua sendo a chave que autoriza, não o telefone, que
 * qualquer um sabe.
 *
 * Envia sozinho uma vez só. Se a chave estiver errada, o formulário fica ali
 * preenchido para a pessoa corrigir em vez de recarregar em looping.
 */
export default function Entrar() {
  const [estado, acao, enviando] = useActionState(entrar, null);
  const [chave, setChave] = useState("");

  const formulario = useRef<HTMLFormElement>(null);
  const jaTentou = useRef(false);

  /**
   * Lê o endereço depois que a página monta, e não com useSearchParams.
   *
   * useSearchParams obriga a página inteira a esperar o JavaScript para
   * aparecer, e tela de entrar nascendo em branco é o pior lugar para isso.
   * Aqui o formulário já vem pronto do servidor e a chave do link entra
   * sozinha logo em seguida.
   */
  useEffect(() => {
    if (jaTentou.current) return;

    const doLink = mascarar(
      new URLSearchParams(window.location.search).get("c") ?? "",
    );
    if (doLink.length < 14) return;

    jaTentou.current = true;
    setChave(doLink);
    // Espera o valor entrar no campo antes de enviar.
    requestAnimationFrame(() => formulario.current?.requestSubmit());
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo tamanho={64} />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl">Entrar na barbearia</h1>
            <p className="text-sm text-texto-suave">
              Serve para o clube e para a equipe. Use a chave que o Johny te
              mandou: não tem e-mail nem senha.
            </p>
          </div>
        </div>

        <form ref={formulario} action={acao} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-texto-apagado">
              Chave de acesso
            </span>
            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texto-apagado"
                strokeWidth={2}
              />
              <input
                name="chave"
                value={chave}
                onChange={(e) => setChave(mascarar(e.target.value))}
                placeholder="JHNY-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                aria-label="Chave de acesso"
                className="num min-h-[56px] w-full rounded-card border border-borda bg-superficie pl-12 pr-4 font-titulo text-lg font-semibold tracking-wide text-texto placeholder:font-corpo placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-texto-apagado"
              />
            </div>
          </label>

          {estado?.erro ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-card border border-alerta/50 bg-superficie px-4 py-3 text-sm text-alerta"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              {estado.erro}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={enviando || chave.length < 14}
            className={`inline-flex min-h-[52px] items-center justify-center rounded-pill px-6 font-titulo text-base font-bold transition-colors ${
              enviando || chave.length < 14
                ? "cursor-not-allowed border border-borda bg-superficie-apagada text-texto-apagado"
                : "bg-acao text-acao-sobre hover:bg-acao-hover"
            }`}
          >
            {enviando ? "Conferindo..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-texto-apagado">
          Perdeu a chave? Fale com o Johny, ele gera outra na hora e a antiga
          para de valer.
        </p>

        <Link
          href="/"
          className="text-center text-sm text-texto-suave transition-colors hover:text-texto"
        >
          Voltar para o site
        </Link>
      </div>
    </main>
  );
}
