"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2 } from "lucide-react";

import { situacaoDoAgendamento } from "@/app/agendar/acoes";

/**
 * A volta da página do cartão.
 *
 * Duas coisas acontecem ao mesmo tempo quando o cliente termina de pagar: o
 * navegador dele volta para cá, e a Stripe avisa o nosso servidor. Não há
 * ordem garantida entre as duas — e quando o navegador chega primeiro, o
 * horário ainda está "esperando pagamento".
 *
 * Sem isto, ele voltaria da compra e veria o QR do pix na tela, como se nada
 * tivesse acontecido. Aqui ele vê que o pagamento passou, e a tela se atualiza
 * sozinha quando a confirmação cai.
 */
export function PagamentoAprovado({
  token,
  jaConfirmado,
}: {
  token: string;
  jaConfirmado: boolean;
}) {
  const router = useRouter();
  const [confirmado, setConfirmado] = useState(jaConfirmado);
  const [demorou, setDemorou] = useState(false);

  useEffect(() => {
    if (confirmado) return;

    // Meio minuto de paciência. Passa disso, o aviso da Stripe não veio, e
    // insistir só deixaria a pessoa olhando um relógio girar.
    const desiste = Date.now() + 30_000;

    const relogio = setInterval(async () => {
      if (Date.now() > desiste) {
        clearInterval(relogio);
        setDemorou(true);
        return;
      }

      const s = await situacaoDoAgendamento(token).catch(() => null);
      if (s?.status === "confirmado") {
        clearInterval(relogio);
        setConfirmado(true);
        // Recarrega para a tela inteira parar de falar em pagamento.
        router.refresh();
      }
    }, 2000);

    return () => clearInterval(relogio);
  }, [token, confirmado, router]);

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-grande border border-acao/50 bg-superficie p-4 sm:p-5"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-pill border border-acao/50 text-acao">
        {confirmado ? (
          <CalendarCheck className="h-5 w-5" strokeWidth={2} />
        ) : (
          <Loader2 className="h-5 w-5 motion-safe:animate-spin" strokeWidth={2} />
        )}
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-titulo text-lg font-bold text-acao">
          {confirmado ? "Pagamento aprovado" : "Recebemos seu pagamento"}
        </span>
        <span className="text-sm text-texto-suave">
          {confirmado
            ? "Seu horário está confirmado. Te esperamos na cadeira."
            : demorou
              ? "O pagamento passou. A confirmação do horário está demorando um pouco mais que o normal — se ela não aparecer em alguns minutos, chame a barbearia no WhatsApp."
              : "Confirmando seu horário, só um instante..."}
        </span>
      </div>
    </div>
  );
}
