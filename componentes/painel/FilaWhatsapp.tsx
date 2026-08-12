"use client";

import { useState, useTransition } from "react";
import { Copy, Trash2 } from "lucide-react";

import {
  darBaixaNoAviso,
  descartarAviso,
  descartarTodosAvisos,
} from "@/app/painel/acoes";
import { CampoBusca, POR_VEZ, VerMais, achatar } from "./Lista";

export type AvisoNaFila = {
  id: string;
  cliente: string;
  texto: string;
  telefone: string | null;
  quando: string;
};

/**
 * A fila do WhatsApp, agora com saída.
 *
 * Antes ela só mostrava dez de trinta e o único botão era "Mandar", que abria
 * o wa.me e deixava o aviso ali para sempre. Resultado: a fila só engordava, e
 * o Johny não conseguia nem ver nem limpar o que já tinha resolvido por fora.
 *
 * Mandar agora dá baixa junto, porque quem abriu a conversa já mandou. E
 * descartar existe para o que ele resolveu no balcão — não apaga nada, só tira
 * da fila.
 */
export function FilaWhatsapp({
  avisos,
  total,
  ehDono,
}: {
  avisos: AvisoNaFila[];
  total: number;
  ehDono: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [ate, setAte] = useState(POR_VEZ);
  const [saindo, setSaindo] = useState<Set<string>>(new Set());
  const [limpando, setLimpando] = useState(false);
  const [, transicao] = useTransition();

  const alvo = achatar(busca);
  const vistos = avisos.filter(
    (a) =>
      !saindo.has(a.id) &&
      (!alvo ||
        achatar(a.cliente).includes(alvo) ||
        achatar(a.texto).includes(alvo) ||
        (a.telefone ?? "").replace(/\D/g, "").includes(busca.replace(/\D/g, ""))),
  );

  // Some da tela na hora e confirma no servidor depois: esperar o round-trip
  // para um botão desses faz parecer travado.
  const tirar = (id: string, acao: (id: string) => Promise<unknown>) => {
    setSaindo((s) => new Set(s).add(id));
    transicao(() => {
      void acao(id);
    });
  };

  const naFila = total - saindo.size;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-texto-suave">
        Sem API oficial, o sistema escreve a mensagem e você dispara. Ao mandar,
        o aviso sai da fila sozinho.
      </p>

      {avisos.length > POR_VEZ ? (
        <CampoBusca
          valor={busca}
          onMudar={(v) => {
            setBusca(v);
            setAte(POR_VEZ);
          }}
          placeholder="Buscar por nome ou telefone"
        />
      ) : null}

      {vistos.length === 0 ? (
        <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-6 text-center text-sm text-texto-suave">
          {busca ? "Ninguém com esse nome na fila." : "Fila vazia."}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {vistos.slice(0, ate).map((a) => (
          <li
            key={a.id}
            className="flex flex-col gap-3 rounded-card border border-borda bg-superficie-ativa px-4 py-3 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="truncate font-titulo text-sm font-semibold">
                  {a.cliente || "Cliente"}
                </span>
                <span className="num shrink-0 text-xs text-texto-apagado">
                  {a.quando}
                </span>
              </span>
              <span className="line-clamp-2 text-xs text-texto-suave">
                {a.texto}
              </span>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {a.telefone ? (
                <a
                  href={`https://wa.me/${numero(a.telefone)}?text=${encodeURIComponent(a.texto)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => tirar(a.id, darBaixaNoAviso)}
                  className="inline-flex min-h-toque items-center gap-1.5 rounded-pill border border-borda-forte px-3 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
                >
                  <Copy className="h-4 w-4" strokeWidth={2} />
                  Mandar
                </a>
              ) : null}

              <button
                type="button"
                onClick={() => tirar(a.id, descartarAviso)}
                aria-label={`Descartar aviso de ${a.cliente}`}
                className="inline-flex min-h-toque items-center gap-1.5 rounded-pill border border-borda px-3 font-titulo text-sm font-semibold text-texto-suave transition-colors hover:border-alerta hover:text-alerta"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                Descartar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <VerMais
          mostrando={Math.min(ate, vistos.length)}
          total={vistos.length}
          geral={naFila}
          onMais={() => setAte((n) => n + POR_VEZ)}
        />
      </div>

      {naFila > avisos.length ? (
        <p className="num text-xs text-texto-apagado">
          a tela carrega {avisos.length} por vez; conforme você limpa, o resto
          aparece
        </p>
      ) : null}

      {ehDono && naFila > 0 ? (
        limpando ? (
          <div className="flex flex-col gap-2 rounded-card border border-alerta/40 bg-superficie-ativa px-4 py-3">
            <span className="text-sm text-texto">
              Descartar os {naFila} avisos da fila? Ninguém recebe mensagem
              nenhuma depois disso.
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSaindo(new Set(avisos.map((a) => a.id)));
                  setLimpando(false);
                  transicao(() => {
                    void descartarTodosAvisos();
                  });
                }}
                className="inline-flex min-h-toque items-center rounded-pill border border-alerta/60 px-4 font-titulo text-sm font-semibold text-alerta transition-colors hover:bg-alerta/10"
              >
                Sim, descartar tudo
              </button>
              <button
                type="button"
                onClick={() => setLimpando(false)}
                className="inline-flex min-h-toque items-center rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto"
              >
                Deixa
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLimpando(true)}
            className="self-start font-titulo text-xs font-semibold text-texto-apagado underline underline-offset-4 hover:text-alerta"
          >
            Descartar a fila inteira
          </button>
        )
      ) : null}
    </div>
  );
}

function numero(telefone: string) {
  const digitos = telefone.replace(/\D/g, "");
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}
