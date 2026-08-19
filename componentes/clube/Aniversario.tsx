"use client";

import { useActionState, useState } from "react";
import { Cake, Check } from "lucide-react";

import { salvarNascimento } from "@/app/clube/acoes";

/**
 * O aniversário do assinante, preenchido por ele mesmo.
 *
 * Não é pedido no agendamento de propósito: lá seria mais um campo entre a
 * pessoa e a cadeira, e para quem corta uma vez só a data não serve para nada.
 * Aqui é diferente — quem abre esta tela volta toda semana.
 *
 * Fica opcional e discreto. Se ninguém preencher, nada quebra; o Johny
 * simplesmente não terá a lista do mês.
 */
export function Aniversario({ atual }: { atual: string | null }) {
  const [estado, acao, salvando] = useActionState(salvarNascimento, null);
  const [aberto, setAberto] = useState(!atual);

  const salvo = estado?.ok ? estado.data : atual;

  const porExtenso = salvo
    ? new Date(`${salvo}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
      })
    : null;

  if (salvo && !aberto) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-borda bg-superficie px-4 py-3">
        <Cake className="h-4 w-4 shrink-0 text-clube" strokeWidth={2} />
        <span className="text-sm text-texto">
          Seu aniversário: <span className="num">{porExtenso}</span>
        </span>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="ml-auto font-titulo text-xs font-semibold text-texto-suave underline underline-offset-4 hover:text-texto"
        >
          trocar
        </button>
      </div>
    );
  }

  return (
    <form
      action={acao}
      className="flex flex-col gap-3 rounded-card border border-borda bg-superficie px-4 py-4"
    >
      <div className="flex items-center gap-2">
        <Cake className="h-4 w-4 shrink-0 text-clube" strokeWidth={2} />
        <span className="font-titulo text-sm font-semibold text-texto">
          Quando é seu aniversário?
        </span>
      </div>

      <p className="text-xs text-texto-suave">
        O Johny gosta de saber. Não é obrigatório, e serve só para isso.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          name="nascimento"
          defaultValue={salvo ?? ""}
          max={new Date().toISOString().slice(0, 10)}
          className="num min-h-toque flex-1 rounded-bloco border border-borda bg-superficie-ativa px-3 text-sm text-texto"
        />
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex min-h-toque items-center gap-1.5 rounded-pill bg-clube px-5 font-titulo text-sm font-bold text-fundo transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {estado?.erro ? (
        <span className="text-xs text-alerta">{estado.erro}</span>
      ) : null}
    </form>
  );
}
