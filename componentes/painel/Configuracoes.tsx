"use client";

import { useActionState } from "react";
import { Check, TriangleAlert } from "lucide-react";

import { salvarConfiguracoes } from "@/app/painel/acoes";
import { formatarTelefone } from "@/lib/pix/brcode";

const campo =
  "min-h-toque w-full rounded-bloco border border-borda bg-superficie px-3 text-sm text-texto";

export function Configuracoes({
  pixKey,
  pixTitular,
  modalidade,
  reservaMinutos,
  clubePreco,
  clubeCortes,
}: {
  pixKey: string;
  pixTitular: string;
  modalidade: "opcional" | "obrigatorio";
  reservaMinutos: number;
  clubePreco: number;
  clubeCortes: number;
}) {
  const [estado, acao, salvando] = useActionState(salvarConfiguracoes, null);

  return (
    <form
      action={acao}
      className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4 sm:p-5"
    >
      <h2 className="text-lg">Ajustes da casa</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-texto-apagado">
            Chave pix
          </span>
          <input name="pixKey" defaultValue={pixKey} className={`num ${campo}`} />
          <span className="num text-xs text-texto-suave">
            aparece para o cliente como {formatarTelefone(pixKey)}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-texto-apagado">
            Nome de quem recebe
          </span>
          <input name="pixTitular" defaultValue={pixTitular} className={campo} />
          <span className="text-xs text-texto-suave">
            o cliente confere esse nome no banco antes de enviar
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-texto-apagado">
            Pagamento
          </span>
          <select name="modalidade" defaultValue={modalidade} className={campo}>
            <option value="opcional">
              Opcional, o horário já fica confirmado
            </option>
            <option value="obrigatorio">
              Obrigatório, segura o horário até o pix cair
            </option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-texto-apagado">
            Minutos de reserva
          </span>
          <input
            name="reservaMinutos"
            type="number"
            min={5}
            max={120}
            defaultValue={reservaMinutos}
            className={`num ${campo}`}
          />
          <span className="text-xs text-texto-suave">
            quanto tempo o horário fica preso esperando o pix
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-texto-apagado">
            Mensalidade do clube (R$)
          </span>
          <input
            name="clubePreco"
            type="number"
            min={0}
            defaultValue={clubePreco}
            className={`num ${campo}`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-texto-apagado">
            Cortes por mês
          </span>
          <input
            name="clubeCortes"
            type="number"
            min={1}
            max={30}
            defaultValue={clubeCortes}
            className={`num ${campo}`}
          />
        </label>
      </div>

      {estado?.erro ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-alerta">
          <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2} />
          {estado.erro}
        </p>
      ) : null}

      {estado?.ok ? (
        <p className="flex items-center gap-2 text-sm text-clube">
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          Salvo. Já vale para o próximo agendamento.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={salvando}
        className="inline-flex min-h-toque items-center justify-center rounded-pill bg-acao px-6 font-titulo text-sm font-bold text-acao-sobre transition-colors hover:bg-acao-hover disabled:opacity-60 sm:self-start"
      >
        {salvando ? "Salvando..." : "Salvar ajustes"}
      </button>
    </form>
  );
}
