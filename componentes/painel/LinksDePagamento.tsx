"use client";

import { useActionState } from "react";
import { Check, CreditCard, TriangleAlert } from "lucide-react";

import { salvarLinksPagamento } from "@/app/painel/acoes";
import { moedaCentavos } from "@/lib/formato";

/**
 * Onde o Johny cola os links de pagamento do PagBank.
 *
 * A lista de valores sai sozinha dos serviços e dos planos do clube: ele não
 * decide quanto vale cada link, só cria no app do PagBank com aquele valor e
 * cola a URL na linha certa.
 *
 * Linha vazia = sem cartão para aquele valor, e o cliente vê só o pix. Nada
 * aqui mexe no pix: aquele continua caindo direto na chave dele, sem taxa.
 */
export function LinksDePagamento({
  valores,
  atuais,
}: {
  valores: { valorCentavos: number; oQue: string }[];
  atuais: Record<number, string>;
}) {
  const [estado, acao, salvando] = useActionState(salvarLinksPagamento, null);
  const quantos = Object.keys(atuais).length;

  return (
    <form
      action={acao}
      className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4 sm:p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5 shrink-0 text-texto-suave" strokeWidth={2} />
          Cartão, débito e pix pelo PagBank
        </h2>
        <p className="text-sm text-texto-suave">
          No app do PagBank, em Vendas → Link de Pagamento, crie um link para
          cada valor abaixo e cole aqui. O cliente passa a ver um segundo botão
          embaixo do pix.
        </p>
        <p className="text-xs text-texto-apagado">
          O que entrar por aqui cai na sua conta PagBank e desconta tarifa,
          inclusive o pix. O QR do site continua caindo direto na sua chave, na
          hora e sem taxa — por isso ele segue em primeiro na tela. E tudo
          continua sendo você quem confirma: o PagBank não avisa o sistema.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {valores.map((v) => (
          <label key={v.valorCentavos} className="flex flex-col gap-1.5">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="num font-titulo text-sm font-bold text-acao">
                {moedaCentavos(v.valorCentavos)}
              </span>
              <span className="min-w-0 truncate text-xs text-texto-suave">
                {v.oQue}
              </span>
            </span>
            <input
              name={`link_${v.valorCentavos}`}
              defaultValue={atuais[v.valorCentavos] ?? ""}
              placeholder="https://pag.ae/..."
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-toque w-full rounded-bloco border border-borda bg-superficie-ativa px-3 text-sm text-texto"
            />
          </label>
        ))}
      </div>

      {valores.length === 0 ? (
        <p className="text-sm text-texto-suave">
          Nenhum serviço com preço cadastrado ainda.
        </p>
      ) : null}

      {estado?.erro ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-alerta">
          <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2} />
          {estado.erro}
        </p>
      ) : null}

      {estado?.ok ? (
        <p className="flex items-center gap-2 text-sm text-clube">
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          Salvo. Já vale para quem for pagar agora.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex min-h-toque items-center justify-center rounded-pill bg-acao px-6 font-titulo text-sm font-bold text-acao-sobre transition-colors hover:bg-acao-hover disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar links"}
        </button>
        <span className="text-xs text-texto-apagado">
          {quantos > 0
            ? `${quantos} ${quantos === 1 ? "valor aceita" : "valores aceitam"} cartão`
            : "nenhum valor aceita cartão ainda"}
        </span>
      </div>
    </form>
  );
}
