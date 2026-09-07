"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Check, Share, TriangleAlert } from "lucide-react";

import {
  avisoDeTeste,
  desinscreverAparelho,
  inscreverAparelho,
} from "@/app/painel/avisos";

/**
 * Ligar os avisos no celular do barbeiro.
 *
 * Eles cortam com a máquina na mão e não ouvem som nenhum: a barbearia é
 * barulhenta e o telefone fica no bolso. Notificação do sistema aparece na
 * tela bloqueada e fica lá até alguém olhar.
 *
 * A tela muda conforme o aparelho, porque o caminho é diferente em cada um —
 * e no iPhone nem existe até o site estar na tela inicial. Explicação genérica
 * aqui vira barbeiro desistindo no meio.
 */

type Estado =
  | "carregando"
  | "sem_suporte"
  | "precisa_instalar"
  | "desligado"
  | "ligado"
  | "bloqueado";

const chaveVapid = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** A chave vai em base64url e o navegador quer bytes. */
function paraBytes(base64: string) {
  const completo = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const cru = atob(completo);
  return Uint8Array.from([...cru].map((c) => c.charCodeAt(0)));
}

export function Avisos() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [enviou, setEnviou] = useState(false);
  const [rodando, comecar] = useTransition();

  const ehIphone =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        // iPhone só ganha notificação depois de o site virar aplicativo.
        setEstado(ehIphone ? "precisa_instalar" : "sem_suporte");
        return;
      }

      if (Notification.permission === "denied") {
        setEstado("bloqueado");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      const jaTem = await reg.pushManager.getSubscription();
      setEstado(jaTem ? "ligado" : "desligado");
    })().catch(() => setEstado("sem_suporte"));
  }, [ehIphone]);

  const ligar = () =>
    comecar(async () => {
      setErro(null);
      try {
        const permissao = await Notification.requestPermission();
        if (permissao !== "granted") {
          setEstado(permissao === "denied" ? "bloqueado" : "desligado");
          return;
        }

        const reg = await navigator.serviceWorker.ready;
        const inscricao = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: paraBytes(chaveVapid()),
        });

        const j = inscricao.toJSON();
        const r = await inscreverAparelho({
          endpoint: inscricao.endpoint,
          p256dh: j.keys?.p256dh ?? "",
          auth: j.keys?.auth ?? "",
        });

        if (r.erro) {
          setErro(r.erro);
          return;
        }
        setEstado("ligado");
      } catch (e) {
        setErro("Não consegui ligar aqui. Tente pelo Chrome ou Safari.");
        console.error(e);
      }
    });

  const desligar = () =>
    comecar(async () => {
      const reg = await navigator.serviceWorker.ready;
      const inscricao = await reg.pushManager.getSubscription();
      if (inscricao) {
        await desinscreverAparelho(inscricao.endpoint);
        await inscricao.unsubscribe();
      }
      setEstado("desligado");
    });

  return (
    <section className="flex flex-col gap-3 rounded-grande border border-borda bg-superficie p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-pill border ${
            estado === "ligado"
              ? "border-clube/50 text-clube"
              : "border-borda-forte text-texto-suave"
          }`}
        >
          {estado === "ligado" ? (
            <Bell className="h-5 w-5" strokeWidth={2} />
          ) : (
            <BellOff className="h-5 w-5" strokeWidth={2} />
          )}
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg">Avisos neste celular</h2>
          <p className="text-sm text-texto-suave">
            {estado === "ligado"
              ? "Ligado. Quando alguém marcar ou desmarcar, aparece na tela do celular mesmo bloqueado."
              : "Enquanto você corta, o celular avisa por conta própria quando alguém marca."}
          </p>
        </div>
      </div>

      {estado === "ligado" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={rodando}
            onClick={() =>
              comecar(async () => {
                const r = await avisoDeTeste();
                setEnviou(r.ok);
              })
            }
            className="inline-flex min-h-toque items-center gap-2 rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao disabled:opacity-60"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            Mandar um teste
          </button>
          <button
            type="button"
            onClick={desligar}
            className="font-titulo text-xs font-semibold text-texto-apagado underline underline-offset-4 hover:text-alerta"
          >
            Desligar neste aparelho
          </button>
          {enviou ? (
            <span className="text-xs text-clube">Mandei. Deve chegar agora.</span>
          ) : null}
        </div>
      ) : null}

      {estado === "desligado" ? (
        <button
          type="button"
          disabled={rodando}
          onClick={ligar}
          className="inline-flex min-h-toque items-center justify-center gap-2 self-start rounded-pill bg-acao px-6 font-titulo text-sm font-bold text-acao-sobre transition-colors hover:bg-acao-hover disabled:opacity-60"
        >
          <Bell className="h-4 w-4" strokeWidth={2.5} />
          {rodando ? "Ligando..." : "Ligar avisos"}
        </button>
      ) : null}

      {estado === "bloqueado" ? (
        <p className="flex items-start gap-2 rounded-card border border-alerta/40 bg-superficie-ativa px-4 py-3 text-sm text-texto-suave">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-alerta" strokeWidth={2} />
          <span>
            Você bloqueou os avisos neste celular. Para voltar: toque no
            cadeado ao lado do endereço do site, depois em{" "}
            <b>Notificações</b>, e escolha permitir. Aí volte aqui.
          </span>
        </p>
      ) : null}

      {estado === "precisa_instalar" ? <ComoInstalar aparelho="iphone" /> : null}
      {estado === "sem_suporte" ? <ComoInstalar aparelho="android" /> : null}

      {erro ? <p className="text-sm text-alerta">{erro}</p> : null}

      {estado === "desligado" || estado === "ligado" ? (
        <details className="text-sm text-texto-suave">
          <summary className="cursor-pointer font-titulo text-xs font-semibold uppercase tracking-wide text-texto-apagado">
            Deixar na tela inicial, como um aplicativo
          </summary>
          <div className="pt-3">
            <ComoInstalar aparelho={ehIphone ? "iphone" : "android"} podeTrocar />
          </div>
        </details>
      ) : null}
    </section>
  );
}

/**
 * O passo a passo, escrito para quem está com o celular na mão.
 *
 * Um caminho por sistema, com o nome do botão como ele aparece de verdade.
 * "Adicione à tela inicial" sozinho não ajuda ninguém a achar o menu.
 */
function ComoInstalar({
  aparelho,
  podeTrocar = false,
}: {
  aparelho: "android" | "iphone";
  /**
   * Deixa ver o caminho do outro sistema.
   *
   * O Johny vai ensinar o Anderson e o Davi olhando o celular dele. Sem isto
   * ele só enxergaria o passo a passo do próprio aparelho, e teria que
   * adivinhar o do outro.
   */
  podeTrocar?: boolean;
}) {
  const [vendo, setVendo] = useState(aparelho);
  const iphone = vendo === "iphone";

  const passos = iphone
    ? [
        "Abra este site no Safari (no iPhone só funciona nele).",
        "Toque no botão de compartilhar, o quadradinho com a seta para cima, embaixo da tela.",
        "Role e toque em Adicionar à Tela de Início.",
        "Toque em Adicionar, no canto de cima.",
        "Abra o ícone do Johny que apareceu na tela inicial e volte aqui para ligar os avisos.",
      ]
    : [
        "Abra este site no Chrome.",
        "Toque nos três pontinhos, no canto de cima à direita.",
        "Toque em Instalar aplicativo (ou Adicionar à tela inicial).",
        "Confirme em Instalar.",
        "Abra o ícone do Johny que apareceu na tela inicial.",
      ];

  return (
    <div className="flex flex-col gap-3 rounded-card border border-borda bg-superficie-ativa px-4 py-4">
      {podeTrocar ? (
        <div className="flex flex-wrap gap-2">
          {(["android", "iphone"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setVendo(a)}
              aria-pressed={vendo === a}
              className={`inline-flex min-h-toque items-center rounded-pill border px-4 font-titulo text-sm font-semibold transition-colors ${
                vendo === a
                  ? "border-acao bg-acao text-acao-sobre"
                  : "border-borda text-texto-suave hover:border-borda-forte"
              }`}
            >
              {a === "android" ? "Android" : "iPhone"}
            </button>
          ))}
        </div>
      ) : (
        <span className="flex items-center gap-2 font-titulo text-sm font-semibold text-texto">
          <Share className="h-4 w-4 shrink-0 text-acao" strokeWidth={2} />
          {iphone ? "No iPhone" : "No Android"}
        </span>
      )}

      <ol className="flex flex-col gap-2">
        {passos.map((p, i) => (
          <li key={p} className="flex gap-3 text-sm text-texto-suave">
            <span className="num shrink-0 font-titulo font-bold text-acao">
              {i + 1}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ol>

      {iphone ? (
        <p className="text-xs text-texto-apagado">
          O iPhone só deixa avisar depois que o site vira ícone na tela
          inicial. Não dá para pular esse passo.
        </p>
      ) : null}
    </div>
  );
}
