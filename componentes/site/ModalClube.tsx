"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, CreditCard, Crown, TriangleAlert, X } from "lucide-react";

import { assinarNoCartao, pedirClube, type PedidoClube } from "@/app/acoes-clube";
import { OutrasFormas } from "@/componentes/agendar/OutrasFormas";
import { PainelPix } from "@/componentes/agendar/PainelPix";

/**
 * Assinar o clube sem sair da landing.
 *
 * O pix nasce na hora, mas a assinatura só vale quando o Johny confirma no
 * painel, igual ao pix de agendamento: a palavra do cliente nunca ativa nada.
 */
export function ModalClube({
  planoId,
  plano,
  preco,
  dias,
  beneficios,
  cartaoDisponivel = false,
}: {
  planoId: string;
  plano: string;
  preco: string;
  dias: string;
  beneficios: string[];
  /** Stripe ligada: dá para assinar no cartão, e aí a liberação é na hora. */
  cartaoDisponivel?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pago, setPago] = useState<Extract<PedidoClube, { ok: true }> | null>(null);
  const [rodando, comecar] = useTransition();

  // Esc fecha, e a página atrás para de rolar enquanto o modal está aberto.
  useEffect(() => {
    if (!aberto) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
    };
  }, [aberto]);

  const campo =
    "min-h-[52px] w-full rounded-card border border-borda bg-superficie-ativa px-4 text-base text-texto placeholder:text-texto-apagado";
  const valido = nome.trim().length >= 2 && telefone.replace(/\D/g, "").length >= 10;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill bg-acao px-6 font-titulo text-base font-bold text-acao-sobre transition-colors hover:bg-acao-hover sm:w-auto sm:self-start"
      >
        <Crown className="h-5 w-5" strokeWidth={2.5} />
        Assinar por {preco}
      </button>

      {aberto ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-fundo-profundo/80 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Assinar ${plano}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAberto(false);
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-grande border border-borda-forte bg-superficie p-5 sm:rounded-grande">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="flex items-center gap-2 text-2xl">
                  <Crown className="h-6 w-6 shrink-0 text-clube" strokeWidth={2.5} />
                  {plano}
                </h2>
                <p className="text-sm text-texto-medio">
                  {preco} por mês, sem limite de vezes, com atendimento de{" "}
                  {dias}. Você escolhe o horário e o barbeiro, só que sem pagar
                  nada na hora.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="grid h-toque w-toque shrink-0 place-items-center rounded-pill text-texto-suave hover:text-texto"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            {pago ? (
              <div className="mt-5 flex flex-col gap-4">
                {pago.jaAssinante ? (
                  <p className="rounded-card border border-clube/40 bg-superficie-ativa px-4 py-3 text-sm text-clube">
                    Você já é do clube. Esse pix serve para adiantar a próxima
                    mensalidade.
                  </p>
                ) : null}

                <PainelPix
                  brcode={pago.brcode}
                  qrSvg={pago.qrSvg}
                  chave={pago.chave}
                  titular={pago.titular}
                  valor={pago.valor}
                  minutos={0}
                  seguraOHorario={false}
                />

                {pago.linkCartao ? (
                  <OutrasFormas url={pago.linkCartao} valor={pago.valor} />
                ) : null}

                <p className="text-sm text-texto-medio">
                  Assim que o pix cair, o Johny libera o seu clube e te chama no
                  WhatsApp.
                </p>

                <a
                  href="/agendar"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-pill bg-acao px-6 font-titulo text-base font-bold text-acao-sobre transition-colors hover:bg-acao-hover"
                >
                  Já quero marcar meu horário
                </a>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-4">
                <ul className="flex flex-col gap-2.5">
                  {beneficios.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <Check
                        className="mt-0.5 h-5 w-5 shrink-0 text-clube"
                        strokeWidth={3}
                      />
                      <span className="text-texto-medio">{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-3 border-t border-borda pt-4">
                  <p className="text-sm text-texto-suave">
                    Me diz quem é você e escolha como quer pagar.
                  </p>

                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                    className={campo}
                  />
                  <input
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(84) 99999-9999"
                    inputMode="tel"
                    autoComplete="tel"
                    className={`num ${campo}`}
                  />

                  {erro ? (
                    <p
                      role="alert"
                      className="flex items-center gap-2 text-sm text-alerta"
                    >
                      <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                      {erro}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={!valido || rodando}
                    onClick={() =>
                      comecar(async () => {
                        const r = await pedirClube({ nome, telefone, planoId });
                        if (!r.ok) setErro(r.erro);
                        else setPago(r);
                      })
                    }
                    className={`inline-flex min-h-[52px] items-center justify-center rounded-pill px-6 font-titulo text-base font-bold transition-colors ${
                      valido && !rodando
                        ? "bg-acao text-acao-sobre hover:bg-acao-hover"
                        : "cursor-not-allowed border border-borda bg-superficie-apagada text-texto-apagado"
                    }`}
                  >
                    {rodando ? "Gerando o pix..." : `Gerar pix de ${preco}`}
                  </button>

                  {/* Cartão libera o clube na hora, porque a confirmação
                      chega sozinha. No pix quem libera é o Johny depois de
                      conferir, e é por isso que os dois textos são
                      diferentes: a espera não é a mesma. */}
                  {cartaoDisponivel ? (
                    <button
                      type="button"
                      disabled={!valido || rodando}
                      onClick={() =>
                        comecar(async () => {
                          const r = await assinarNoCartao({
                            nome,
                            telefone,
                            planoId,
                          });
                          if (r.erro || !r.url) {
                            setErro(r.erro ?? "Não consegui abrir o cartão.");
                            return;
                          }
                          window.location.href = r.url;
                        })
                      }
                      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-pill border px-6 font-titulo text-base font-semibold transition-colors ${
                        valido && !rodando
                          ? "border-borda-forte text-texto hover:border-clube hover:text-clube"
                          : "cursor-not-allowed border-borda text-texto-apagado"
                      }`}
                    >
                      <CreditCard className="h-5 w-5 shrink-0" strokeWidth={2} />
                      Assinar no cartão · {preco}
                    </button>
                  ) : null}

                  <p className="text-xs text-texto-suave">
                    Cancela quando quiser, sem multa.{" "}
                    {cartaoDisponivel
                      ? "No cartão o clube libera na hora; no pix o Johny confirma e libera."
                      : "O Johny confirma o pagamento e libera seus cortes."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
