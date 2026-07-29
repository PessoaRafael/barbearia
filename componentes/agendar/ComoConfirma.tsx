import { Check, Clock, MessageCircle, Send } from "lucide-react";

/**
 * O cliente pagou e ficou sem saber se está marcado ou não.
 *
 * A confirmação depende do Johny olhar o extrato, então o silêncio entre o
 * pagamento e o aviso precisa ser explicado, ou ele liga para a barbearia
 * achando que deu errado.
 */
export function ComoConfirma({
  minutos,
  whatsapp,
  mensagem,
  compacto = false,
}: {
  minutos: number;
  /** Telefone da barbearia. Sem ele, o botão de avisar não aparece. */
  whatsapp?: string | null;
  mensagem?: string;
  compacto?: boolean;
}) {
  const digitos = (whatsapp ?? "").replace(/\D/g, "");
  const numero = digitos
    ? digitos.startsWith("55")
      ? digitos
      : `55${digitos}`
    : null;
  const passos = [
    {
      icone: <Send className="h-4 w-4" strokeWidth={2.5} />,
      texto: "Você paga o pix pelo QR ou pelo código.",
      feito: true,
    },
    {
      icone: <Clock className="h-4 w-4" strokeWidth={2.5} />,
      texto: `O Johny confere no extrato e dá o ok. A cadeira fica no seu nome por ${minutos} minutos.`,
      feito: false,
    },
    {
      // Não existe envio automático: quem manda a mensagem é o Johny, do
      // WhatsApp dele. Prometer "você recebe" faria o cliente esperar um robô
      // que não existe e ligar para a barbearia quando não chegasse.
      icone: <Check className="h-4 w-4" strokeWidth={2.5} />,
      texto: "O Johny te manda a confirmação no WhatsApp. Aí sim está marcado.",
      feito: false,
    },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-card border border-borda-forte bg-superficie-ativa p-4">
      <span className="font-titulo text-sm font-semibold text-texto">
        Como seu horário confirma
      </span>

      <ol className="flex flex-col gap-2.5">
        {passos.map((passo, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill ${
                passo.feito
                  ? "bg-clube text-fundo"
                  : "border border-borda-forte text-texto-suave"
              }`}
            >
              {passo.icone}
            </span>
            <span className="text-sm text-texto-medio">{passo.texto}</span>
          </li>
        ))}
      </ol>

      {numero ? (
        <div className="flex flex-col gap-2 border-t border-borda pt-3">
          <a
            href={`https://wa.me/${numero}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-toque items-center justify-center gap-2 rounded-pill border border-borda-forte px-5 font-titulo text-sm font-bold text-texto transition-colors hover:border-acao"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
            Já paguei, avisar no WhatsApp
          </a>
          <p className="text-xs text-texto-suave">
            Não é obrigatório, e o comprovante não confirma nada sozinho: o
            Johny confere no extrato de qualquer jeito. Serve só para ele olhar
            mais rápido.
          </p>
        </div>
      ) : compacto ? null : (
        <p className="border-t border-borda pt-3 text-xs text-texto-suave">
          Se der algum problema, o Johny te chama.
        </p>
      )}
    </div>
  );
}
