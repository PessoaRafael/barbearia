"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  KeyRound,
  MessageCircle,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";

import {
  decidirPix,
  encerrar,
  gerarChaveDe,
  liberarBloqueio,
  revogarChaveDe,
} from "@/app/painel/acoes";
import { BotaoCopiar } from "@/componentes/BotaoCopiar";

const pill =
  "inline-flex min-h-toque items-center justify-center gap-2 rounded-pill px-4 font-titulo text-sm font-semibold transition-colors";

/**
 * Recebi / Não caiu. A palavra do cliente nunca confirma nada.
 *
 * Confirmar e avisar são um passo só de propósito: sem API de WhatsApp, a
 * mensagem depende de alguém clicar. Se o aviso ficasse numa fila noutra tela,
 * o cliente pagaria e não receberia nada, que é exatamente o que ele teme.
 */
export function DecidirPix({
  pagamentoId,
  telefone,
  aviso,
}: {
  pagamentoId: string;
  telefone?: string;
  aviso?: string;
}) {
  const [rodando, comecar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  const decidir = (recebido: boolean) =>
    comecar(async () => {
      const r = await decidirPix(pagamentoId, recebido);
      setErro(r.erro ?? null);
      if (!r.erro && recebido) setConfirmado(true);
    });

  if (confirmado && telefone && aviso) {
    const digitos = telefone.replace(/\D/g, "");
    const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;

    return (
      <div className="flex flex-col gap-2 rounded-card border border-clube/40 bg-superficie p-3">
        <span className="text-sm text-clube">
          Confirmado. Falta avisar o cliente, que o sistema não manda sozinho.
        </span>
        <a
          href={`https://wa.me/${numero}?text=${encodeURIComponent(aviso)}`}
          target="_blank"
          rel="noreferrer"
          className={`${pill} bg-acao text-acao-sobre hover:bg-acao-hover`}
        >
          <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
          Avisar no WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={rodando}
          onClick={() => decidir(true)}
          className={`${pill} bg-acao text-acao-sobre hover:bg-acao-hover disabled:opacity-60`}
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
          Recebi
        </button>
        <button
          type="button"
          disabled={rodando}
          onClick={() => decidir(false)}
          className={`${pill} border border-alerta/60 text-alerta hover:bg-alerta/10 disabled:opacity-60`}
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
          Não caiu
        </button>
      </div>
      {erro ? <span className="text-xs text-alerta">{erro}</span> : null}
    </div>
  );
}

export function EncerrarAtendimento({ agendamentoId }: { agendamentoId: string }) {
  const [rodando, comecar] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={rodando}
        onClick={() => comecar(() => encerrar(agendamentoId, "concluido").then(() => {}))}
        className={`${pill} border border-borda-forte text-texto hover:border-acao disabled:opacity-60`}
      >
        Concluir
      </button>
      <button
        type="button"
        disabled={rodando}
        onClick={() => comecar(() => encerrar(agendamentoId, "faltou").then(() => {}))}
        className={`${pill} border border-borda text-texto-suave hover:border-alerta hover:text-alerta disabled:opacity-60`}
      >
        Faltou
      </button>
    </div>
  );
}

/** Um id, ou vários quando o mesmo horário foi fechado para a casa toda. */
export function SoltarBloqueio({
  bloqueioId,
}: {
  bloqueioId: string | string[];
}) {
  const [rodando, comecar] = useTransition();

  return (
    <button
      type="button"
      disabled={rodando}
      onClick={() => comecar(() => liberarBloqueio(bloqueioId).then(() => {}))}
      className="inline-flex min-h-toque items-center gap-2 rounded-pill border border-borda-forte px-3 font-titulo text-sm font-semibold text-texto-suave transition-colors hover:border-acao hover:text-texto disabled:opacity-60"
    >
      <Trash2 className="h-4 w-4" strokeWidth={2} />
      Liberar
    </button>
  );
}

/**
 * A chave aparece uma vez só. Depois disso, nem o Johny consegue vê-la de
 * novo, no banco tem só o hash.
 */
export function GerarChave({
  barbeiroId,
  nome,
  temChave,
}: {
  barbeiroId: string;
  nome: string;
  temChave: boolean;
}) {
  const [rodando, comecar] = useTransition();
  const [chave, setChave] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const gerar = () =>
    comecar(async () => {
      const r = await gerarChaveDe(barbeiroId);
      if (r.erro) setErro(r.erro);
      else if (r.chave) {
        setErro(null);
        setConfirmando(false);
        setChave(r.chave);
      }
    });

  if (chave) {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-acao/50 bg-superficie-ativa p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-texto-apagado">
            Chave do {nome}
          </span>
          <span className="num font-titulo text-2xl font-bold tracking-wide text-acao">
            {chave}
          </span>
        </div>
        <p className="text-xs text-alerta">
          Anote ou mande agora: essa chave não aparece de novo. Se perder, é só
          gerar outra, a antiga para de valer na hora.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <BotaoCopiar valor={chave} rotulo="Copiar chave" destaque />
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Sua chave de acesso da Johny Barbearia: ${chave}\nEntre em johnybarbearia.com.br/entrar`,
            )}`}
            target="_blank"
            rel="noreferrer"
            className={`${pill} border border-borda-forte text-texto hover:border-acao`}
          >
            Mandar no WhatsApp
          </a>
          <button
            type="button"
            onClick={() => setChave(null)}
            className={`${pill} text-texto-suave hover:text-texto`}
          >
            Já anotei
          </button>
        </div>
      </div>
    );
  }

  // Mesma confirmação da chave do assinante, e pelo mesmo motivo: gerar
  // derruba a anterior na hora, e o Anderson já ficou de fora assim.
  if (temChave && confirmando) {
    return (
      <div className="flex flex-col gap-2 rounded-card border border-alerta/50 bg-superficie-ativa p-3">
        <span className="text-xs text-texto">
          A chave atual de {nome} <b>para de funcionar na hora</b>. Ele vai
          precisar da nova para entrar no painel.
        </span>
        {erro ? <span className="text-xs text-alerta">{erro}</span> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={rodando}
            onClick={gerar}
            className={`${pill} border border-alerta/60 text-alerta hover:bg-alerta/10 disabled:opacity-60`}
          >
            {rodando ? "Gerando..." : "Gerar e mandar agora"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className={`${pill} text-texto-suave hover:text-texto`}
          >
            Deixa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={rodando}
        onClick={() => (temChave ? setConfirmando(true) : gerar())}
        className={`${pill} ${
          temChave
            ? "border border-borda-forte text-texto hover:border-acao"
            : "bg-acao text-acao-sobre hover:bg-acao-hover"
        } disabled:opacity-60`}
      >
        <KeyRound className="h-4 w-4" strokeWidth={2} />
        {rodando ? "Gerando..." : temChave ? "Gerar outra" : "Gerar chave"}
      </button>
      {erro ? <span className="text-xs text-alerta">{erro}</span> : null}
    </div>
  );
}

export function RevogarChave({ chaveId }: { chaveId: string }) {
  const [rodando, comecar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-toque items-center gap-2 rounded-pill border border-borda px-3 font-titulo text-sm font-semibold text-texto-suave transition-colors hover:border-alerta hover:text-alerta"
      >
        <ShieldOff className="h-4 w-4" strokeWidth={2} />
        Revogar
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-alerta/50 bg-superficie p-3">
      <span className="text-xs text-alerta">
        Revogar derruba a sessão dele no próximo clique.
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={rodando}
          onClick={() => comecar(() => revogarChaveDe(chaveId).then(() => {}))}
          className={`${pill} border border-alerta/60 text-alerta hover:bg-alerta/10`}
        >
          Revogar mesmo
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className={`${pill} border border-borda-forte text-texto`}
        >
          Deixa
        </button>
      </div>
    </div>
  );
}

/** Link pronto para o Johny disparar, já que não há API oficial. */
export function AvisoWhatsapp({
  telefone,
  texto,
}: {
  telefone: string;
  texto: string;
}) {
  const digitos = telefone.replace(/\D/g, "");
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;

  return (
    <a
      href={`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`}
      target="_blank"
      rel="noreferrer"
      className={`${pill} border border-borda-forte text-texto hover:border-acao`}
    >
      <Copy className="h-4 w-4" strokeWidth={2} />
      Mandar
    </a>
  );
}
