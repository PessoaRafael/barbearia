"use client";

import { useActionState, useState } from "react";
import { CalendarX2 } from "lucide-react";

import { cancelar } from "@/app/meu-agendamento/[token]/acoes";
import { HORAS_LIMITE_CANCELAMENTO } from "@/lib/regras";

/**
 * Desmarcar sem sair da área do clube.
 *
 * O cliente já podia cancelar, mas o botão morava na tela do agendamento, uma
 * navegação adiante — na prática ninguém achava, e sobrava ligar para o Johny
 * desmarcar na mão. Aqui é o mesmo caminho de sempre, com a mesma regra de
 * horas: só muda o lugar do botão.
 *
 * Pede confirmação porque o toque errado aqui custa a cadeira da pessoa.
 */
export function Desmarcar({ token, inicio }: { token: string; inicio: string }) {
  const [estado, acao, enviando] = useActionState(cancelar, null);
  const [confirmando, setConfirmando] = useState(false);

  const faltam = new Date(inicio).getTime() - Date.now();
  const daTempo = faltam > HORAS_LIMITE_CANCELAMENTO * 60 * 60 * 1000;

  if (estado?.ok) {
    return (
      <span className="shrink-0 text-xs text-texto-suave">Desmarcado.</span>
    );
  }

  // Perto demais da hora: o horário já não volta para a grade a tempo de
  // alguém pegar, então quem decide é a barbearia, não a tela.
  if (!daTempo) {
    return (
      <span className="shrink-0 text-xs text-texto-apagado">
        para desmarcar, chame no WhatsApp
      </span>
    );
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-toque shrink-0 items-center gap-1.5 rounded-pill border border-borda px-3 font-titulo text-sm font-semibold text-texto-suave transition-colors hover:border-alerta hover:text-alerta"
      >
        <CalendarX2 className="h-4 w-4" strokeWidth={2} />
        Desmarcar
      </button>
    );
  }

  return (
    <form action={acao} className="flex w-full flex-col gap-2">
      <input type="hidden" name="token" value={token} />
      <span className="text-xs text-texto-suave">
        Desmarcar mesmo? A cadeira volta para a agenda na hora.
      </span>

      {estado?.erro ? (
        <span className="text-xs text-alerta">{estado.erro}</span>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex min-h-toque items-center rounded-pill border border-alerta/60 px-4 font-titulo text-sm font-semibold text-alerta transition-colors hover:bg-alerta/10 disabled:opacity-60"
        >
          {enviando ? "Desmarcando..." : "Sim, desmarcar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="inline-flex min-h-toque items-center rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto"
        >
          Deixa
        </button>
      </div>
    </form>
  );
}
