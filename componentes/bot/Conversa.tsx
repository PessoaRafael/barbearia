"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, Lightbulb, SendHorizontal, X } from "lucide-react";

import {
  conversar,
  type Estado,
  type Opcao,
  type Resposta,
} from "@/app/bot/acoes";
import { ComoConfirma } from "@/componentes/agendar/ComoConfirma";
import { PainelPix } from "@/componentes/agendar/PainelPix";
import { Logo } from "@/componentes/base";

type Fala = { de: "bot" | "eu"; texto: string };

export function Conversa({
  aberturaFalas,
  aberturaOpcoes,
  exemplos,
}: {
  aberturaFalas: string[];
  aberturaOpcoes: Opcao[];
  exemplos: string[];
}) {
  // As dicas somem depois da primeira mensagem, mas voltam pelo "como pedir":
  // quem travou no meio da conversa é justamente quem precisa delas.
  const [mostrarDicas, setMostrarDicas] = useState(true);
  const [falas, setFalas] = useState<Fala[]>(
    aberturaFalas.map((texto) => ({ de: "bot" as const, texto })),
  );
  const [opcoes, setOpcoes] = useState<Opcao[]>(aberturaOpcoes);
  const [estado, setEstado] = useState<Estado>({});
  const [texto, setTexto] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [pix, setPix] = useState<Resposta["pix"]>(null);
  const [pensando, comecar] = useTransition();

  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [falas, pensando]);

  function mandar(mensagem: string) {
    const limpo = mensagem.trim();
    if (!limpo || pensando) return;

    setFalas((atual) => [...atual, { de: "eu", texto: limpo }]);
    setTexto("");
    setOpcoes([]);

    comecar(async () => {
      const r = await conversar(estado, limpo);
      setEstado(r.estado);
      setFalas((atual) => [
        ...atual,
        ...r.falas.map((t) => ({ de: "bot" as const, texto: t })),
      ]);
      setOpcoes(r.opcoes);
      if (r.token) setToken(r.token);
      if (r.pix) setPix(r.pix);
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 px-5 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 sm:gap-3">
          <Link
            href="/"
            aria-label="Voltar para o início"
            className="-ml-2 inline-flex min-h-toque min-w-toque shrink-0 items-center justify-center rounded-pill text-texto-suave transition-colors hover:text-texto"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <Logo tamanho={36} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-titulo text-base font-bold leading-tight">
              Marcar pelo chat
            </span>
            <span className="flex items-center gap-1.5 text-xs text-texto-suave">
              <span className="h-1.5 w-1.5 rounded-pill bg-clube" />
              respondendo agora
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMostrarDicas((v) => !v)}
            aria-pressed={mostrarDicas}
            className={`ml-auto inline-flex min-h-toque shrink-0 items-center gap-2 rounded-pill border px-4 font-titulo text-sm font-semibold transition-colors ${
              mostrarDicas
                ? "border-acao text-acao"
                : "border-borda-forte text-texto hover:border-acao"
            }`}
          >
            <Lightbulb className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">Como pedir</span>
          </button>
          <Link
            href="/agendar"
            className="hidden shrink-0 items-center rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao sm:inline-flex sm:min-h-toque"
          >
            Prefiro a agenda
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-5 py-6 sm:px-8">
        {falas.map((f, i) => (
          <div
            key={i}
            className={`flex ${f.de === "eu" ? "justify-end" : "justify-start"}`}
          >
            <p
              className={`max-w-[85%] whitespace-pre-line rounded-grande px-4 py-3 text-sm ${
                f.de === "eu"
                  ? "bg-acao text-acao-sobre"
                  : "border border-borda bg-superficie text-texto"
              }`}
            >
              {f.texto}
            </p>
          </div>
        ))}

        {pensando ? (
          <div className="flex justify-start">
            <p className="flex gap-1 rounded-grande border border-borda bg-superficie px-4 py-4">
              {[0, 150, 300].map((atraso) => (
                <span
                  key={atraso}
                  className="h-1.5 w-1.5 animate-bounce rounded-pill bg-texto-apagado"
                  style={{ animationDelay: `${atraso}ms` }}
                />
              ))}
            </p>
          </div>
        ) : null}

        {/* O pix aparece dentro da conversa: pagar não pode exigir sair daqui. */}
        {pix ? (
          <div className="flex justify-start">
            <div className="w-full max-w-[92%]">
              <PainelPix
                brcode={pix.brcode}
                qrSvg={pix.qrSvg}
                chave={pix.chave}
                titular={pix.titular}
                valor={pix.valor}
                minutos={pix.minutos}
                seguraOHorario={pix.seguraOHorario}
              />
              {pix.seguraOHorario ? (
                <div className="mt-3">
                  <ComoConfirma minutos={pix.minutos} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {token ? (
          <Link
            href={`/meu-agendamento/${token}`}
            className="inline-flex min-h-[52px] items-center justify-center rounded-pill bg-acao px-6 font-titulo text-base font-bold text-acao-sobre transition-colors hover:bg-acao-hover"
          >
            Ver meu agendamento
          </Link>
        ) : null}

        <div ref={fim} />
      </main>

      {!token ? (
        <div className="sticky bottom-0 border-t border-borda bg-superficie px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 sm:px-8">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            {mostrarDicas ? (
              <div className="flex flex-col gap-2 rounded-card border border-borda-forte bg-superficie-ativa p-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 shrink-0 text-acao" strokeWidth={2} />
                  <span className="flex-1 text-xs text-texto-suave">
                    Pode escrever solto. Quanto mais coisa na mesma frase, menos
                    eu pergunto:
                  </span>
                  <button
                    type="button"
                    onClick={() => setMostrarDicas(false)}
                    aria-label="Fechar dicas"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-pill text-texto-apagado hover:text-texto"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  {exemplos.map((exemplo) => (
                    <button
                      key={exemplo}
                      type="button"
                      onClick={() => {
                        setMostrarDicas(false);
                        mandar(exemplo);
                      }}
                      className="rounded-bloco border border-borda bg-superficie px-3 py-2.5 text-left text-sm text-texto transition-colors hover:border-acao"
                    >
                      “{exemplo}”
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {opcoes.length ? (
              <div className="trilho flex gap-2 overflow-x-auto">
                {opcoes.map((o) => (
                  <button
                    key={o.valor}
                    type="button"
                    onClick={() => mandar(o.valor)}
                    className="inline-flex min-h-toque shrink-0 items-center rounded-pill border border-borda-forte bg-superficie-ativa px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
                  >
                    {o.rotulo}
                  </button>
                ))}
              </div>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                mandar(texto);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escreve do seu jeito..."
                aria-label="Sua mensagem"
                className="min-h-toque flex-1 rounded-pill border border-borda bg-superficie-ativa px-4 text-base text-texto placeholder:text-texto-apagado"
              />
              <button
                type="submit"
                disabled={!texto.trim() || pensando}
                aria-label="Enviar"
                className={`grid h-toque w-toque shrink-0 place-items-center rounded-pill transition-colors ${
                  texto.trim() && !pensando
                    ? "bg-acao text-acao-sobre hover:bg-acao-hover"
                    : "border border-borda bg-superficie-apagada text-texto-apagado"
                }`}
              >
                <SendHorizontal className="h-5 w-5" strokeWidth={2} />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
