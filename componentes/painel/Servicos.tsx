"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Pencil, Plus, X } from "lucide-react";

import { alternarServico, salvarServico } from "@/app/painel/acoes";
import { moedaCentavos } from "@/lib/formato";

export type ServicoLinha = {
  id: string;
  nome: string;
  categoria: string;
  duracao_min: number;
  preco_centavos: number;
  coberto_pelo_clube: boolean;
  abate_centavos: number;
  tag: string | null;
  ativo: boolean;
};

const campo =
  "min-h-toque w-full rounded-bloco border border-borda bg-superficie px-3 text-sm text-texto";

export function Servicos({ lista }: { lista: ServicoLinha[] }) {
  const [editando, setEditando] = useState<string | "novo" | null>(null);

  return (
    <section className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Serviços · {lista.filter((s) => s.ativo).length}</h2>
        <button
          type="button"
          onClick={() => setEditando(editando === "novo" ? null : "novo")}
          className="inline-flex min-h-toque items-center gap-2 rounded-pill bg-acao px-4 font-titulo text-sm font-bold text-acao-sobre transition-colors hover:bg-acao-hover"
        >
          {editando === "novo" ? (
            <X className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          )}
          {editando === "novo" ? "Fechar" : "Novo serviço"}
        </button>
      </div>

      {editando === "novo" ? (
        <Formulario servico={null} onFechar={() => setEditando(null)} />
      ) : null}

      <ul className="flex flex-col gap-2">
        {lista.map((s) =>
          editando === s.id ? (
            <li key={s.id}>
              <Formulario servico={s} onFechar={() => setEditando(null)} />
            </li>
          ) : (
            <li
              key={s.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border px-4 py-3 ${
                s.ativo
                  ? "border-borda bg-superficie-ativa"
                  : "border-borda bg-superficie-apagada opacity-70"
              }`}
            >
              <div className="flex min-w-0 flex-[1_1_50%] flex-col">
                <span className="truncate font-titulo text-sm font-semibold">
                  {s.nome}
                  {s.tag ? (
                    <span className="ml-2 rounded-pill border border-borda px-2 py-0.5 text-xs font-normal text-texto-suave">
                      {s.tag}
                    </span>
                  ) : null}
                </span>
                <span className="num truncate text-xs text-texto-suave">
                  {s.categoria} · {s.duracao_min} min
                  {s.coberto_pelo_clube
                    ? ` · clube abate ${moedaCentavos(s.abate_centavos)}`
                    : ""}
                </span>
              </div>

              <span className="num ml-auto shrink-0 font-titulo text-base font-bold text-acao">
                {moedaCentavos(s.preco_centavos)}
              </span>

              <button
                type="button"
                onClick={() => setEditando(s.id)}
                className="inline-flex min-h-toque shrink-0 items-center gap-2 rounded-pill border border-borda-forte px-3 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
              >
                <Pencil className="h-4 w-4" strokeWidth={2} />
                Editar
              </button>

              <Alternar servicoId={s.id} ativo={s.ativo} />
            </li>
          ),
        )}
      </ul>

      <p className="text-xs text-texto-apagado">
        Tirar da régua não apaga: agendamento antigo continua apontando para o
        serviço, e apagar quebraria o histórico.
      </p>
    </section>
  );
}

function Alternar({ servicoId, ativo }: { servicoId: string; ativo: boolean }) {
  const [rodando, comecar] = useTransition();

  return (
    <button
      type="button"
      disabled={rodando}
      onClick={() => comecar(() => alternarServico(servicoId, !ativo).then(() => {}))}
      title={ativo ? "Tirar da régua" : "Voltar para a régua"}
      className="inline-flex min-h-toque shrink-0 items-center gap-2 rounded-pill border border-borda px-3 font-titulo text-sm font-semibold text-texto-suave transition-colors hover:border-borda-forte hover:text-texto disabled:opacity-60"
    >
      {ativo ? (
        <EyeOff className="h-4 w-4" strokeWidth={2} />
      ) : (
        <Eye className="h-4 w-4" strokeWidth={2} />
      )}
      {ativo ? "Esconder" : "Mostrar"}
    </button>
  );
}

function Formulario({
  servico,
  onFechar,
}: {
  servico: ServicoLinha | null;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(servico?.nome ?? "");
  const [categoria, setCategoria] = useState(servico?.categoria ?? "Cortes");
  const [duracao, setDuracao] = useState(String(servico?.duracao_min ?? 30));
  const [preco, setPreco] = useState(
    servico ? String(servico.preco_centavos / 100) : "",
  );
  const [clube, setClube] = useState(servico?.coberto_pelo_clube ?? false);
  const [abate, setAbate] = useState(
    servico ? String(servico.abate_centavos / 100) : "",
  );
  const [tag, setTag] = useState(servico?.tag ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, comecar] = useTransition();

  const valido = nome.trim().length >= 2 && Number(duracao) >= 5 && preco !== "";

  return (
    <div className="flex flex-col gap-3 rounded-card border border-borda-forte bg-superficie-ativa p-4">
      <span className="font-titulo text-sm font-semibold">
        {servico ? `Editando ${servico.nome}` : "Serviço novo"}
      </span>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-texto-suave">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-texto-suave">Categoria</span>
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Cortes, Barba, Acabamento..."
            className={campo}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-texto-suave">Duração (min)</span>
          <input
            type="number"
            min={5}
            step={5}
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            className={`num ${campo}`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-texto-suave">Preço (R$)</span>
          <input
            type="number"
            min={0}
            step="0.5"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            className={`num ${campo}`}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-texto-suave">Etiqueta (opcional)</span>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="mais pedido, clube cobre o corte..."
            className={campo}
          />
        </label>
      </div>

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={clube}
          onChange={(e) => setClube(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-[#F5CE0A]"
        />
        <span className="text-sm text-texto">Entra no Clube Johny</span>
      </label>

      {clube ? (
        <label className="flex flex-col gap-1.5 sm:max-w-[220px]">
          <span className="text-xs text-texto-suave">Quanto o clube abate (R$)</span>
          <input
            type="number"
            min={0}
            step="0.5"
            value={abate}
            onChange={(e) => setAbate(e.target.value)}
            className={`num ${campo}`}
          />
          <span className="text-xs text-texto-suave">
            Igual ao preço, o corte sai de graça. Menor, o cliente paga a
            diferença na cadeira.
          </span>
        </label>
      ) : null}

      {erro ? <span className="text-xs text-alerta">{erro}</span> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!valido || rodando}
          onClick={() =>
            comecar(async () => {
              const r = await salvarServico({
                id: servico?.id ?? null,
                nome,
                categoria,
                duracaoMin: duracao,
                preco,
                cobertoPeloClube: clube,
                abate: clube ? abate || preco : 0,
                tag: tag || null,
              });
              if (r.erro) setErro(r.erro);
              else onFechar();
            })
          }
          className={`inline-flex min-h-toque items-center justify-center rounded-pill px-5 font-titulo text-sm font-bold transition-colors ${
            valido && !rodando
              ? "bg-acao text-acao-sobre hover:bg-acao-hover"
              : "cursor-not-allowed border border-borda bg-superficie-apagada text-texto-apagado"
          }`}
        >
          {rodando ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={onFechar}
          className="inline-flex min-h-toque items-center justify-center rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
