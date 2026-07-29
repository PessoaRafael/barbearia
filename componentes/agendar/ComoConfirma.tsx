import { Check, Clock, Send } from "lucide-react";

/**
 * O cliente pagou e ficou sem saber se está marcado ou não.
 *
 * A confirmação depende do Johny olhar o extrato, então o silêncio entre o
 * pagamento e o aviso precisa ser explicado, ou ele liga para a barbearia
 * achando que deu errado.
 */
export function ComoConfirma({
  minutos,
  compacto = false,
}: {
  minutos: number;
  compacto?: boolean;
}) {
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
      icone: <Check className="h-4 w-4" strokeWidth={2.5} />,
      texto: "Você recebe a confirmação no WhatsApp. Aí sim está marcado.",
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

      {compacto ? null : (
        <p className="border-t border-borda pt-3 text-xs text-texto-suave">
          Não precisa mandar comprovante nem avisar por aqui. Se der algum
          problema, o Johny te chama.
        </p>
      )}
    </div>
  );
}
