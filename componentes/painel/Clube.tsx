"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Crown, KeyRound, Plus, UserPlus, X } from "lucide-react";

import {
  achatar,
  CampoBusca,
  curto,
  Filtro,
  POR_VEZ,
  TrilhoDeFiltros,
  VerMais,
} from "./Lista";
import {
  cancelarAssinatura,
  gerarChaveCliente,
  inscreverNoClube,
  registrarMensalidade,
} from "@/app/painel/acoes";
import { AvisoWhatsapp } from "./Acoes";
import { BotaoCopiar } from "@/componentes/BotaoCopiar";
import { moedaCentavos, telefoneBonito } from "@/lib/formato";
import { textoDe } from "@/lib/notify/textos";

export type PlanoDoPainel = {
  id: string;
  nome: string;
  preco_centavos: number;
  dias_semana: number[];
};

export type Assinante = {
  id: string;
  clienteId: string;
  plano: string | null;
  status: string;
  precoCentavos: number;
  cortesMes: number;
  cicloFim: string;
  proximaCobranca: string;
  nome: string;
  telefone: string;
  planoDias: number[];
  chave: { id: string; prefixo: string; ultimoAcesso: string | null } | null;
};

const pill =
  "inline-flex min-h-toque items-center justify-center gap-2 rounded-pill px-4 font-titulo text-sm font-semibold transition-colors";

/**
 * Quem atende sexta ou sábado veio de antes da regra nova.
 *
 * É o mesmo plano — muda só o dia que essas pessoas podem marcar. Por isso
 * vira etiqueta na pessoa, e não outro item no filtro: separar em dois chips
 * com o mesmo nome faria parecer que existem dois produtos.
 */
const ehAntigo = (dias: number[]) => dias.includes(5) || dias.includes(6);

/** "2026-09-10" vira "10/09": ninguém lê data ISO num cartão de cliente. */
const dia = (data: string) =>
  data ? data.split("-").reverse().slice(0, 2).join("/") : "";

export function Clube({
  lista,
  planos,
  pixKey,
}: {
  lista: Assinante[];
  planos: PlanoDoPainel[];
  pixKey: string;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [quantos, setQuantos] = useState(POR_VEZ);

  const vencidos = lista.filter((a) => a.status === "vencida");
  const antigos = lista.filter((a) => ehAntigo(a.planoDias));
  const planosNaLista = [...new Set(lista.map((a) => a.plano).filter(Boolean))];

  /**
   * Busca e filtro no navegador, não no servidor.
   *
   * A lista inteira já veio junto com a página, e são dezenas, não milhares:
   * ir ao banco a cada letra digitada seria mais lento e ainda piscaria a tela.
   * Se um dia passar de umas poucas centenas, isso vira consulta paginada.
   */
  const filtrados = useMemo(() => {
    const termo = achatar(busca.trim());
    const digitos = busca.replace(/\D/g, "");

    return lista.filter((a) => {
      if (filtro === "vencidas" && a.status !== "vencida") return false;
      if (filtro === "antigos" && !ehAntigo(a.planoDias)) return false;
      if (
        filtro !== "todos" &&
        filtro !== "vencidas" &&
        filtro !== "antigos" &&
        a.plano !== filtro
      ) {
        return false;
      }
      if (!termo) return true;

      return (
        achatar(a.nome).includes(termo) ||
        (digitos.length >= 3 && a.telefone.includes(digitos))
      );
    });
  }, [lista, busca, filtro]);

  const mostrando = filtrados.slice(0, quantos);

  const trocarFiltro = (valor: string) => {
    setFiltro(valor);
    setQuantos(POR_VEZ);
  };

  return (
    <section className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Clube · {lista.length} assinantes</h2>
        <button
          type="button"
          onClick={() => setAbrindo(!abrindo)}
          className={`${pill} bg-acao text-acao-sobre hover:bg-acao-hover`}
        >
          {abrindo ? (
            <X className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <UserPlus className="h-4 w-4" strokeWidth={2.5} />
          )}
          {abrindo ? "Fechar" : "Colocar no clube"}
        </button>
      </div>

      {abrindo ? (
        <Inscrever planos={planos} onPronto={() => setAbrindo(false)} />
      ) : null}

      {lista.length > 8 ? (
        <div className="flex flex-col gap-2">
          <CampoBusca
            valor={busca}
            onMudar={(v) => {
              setBusca(v);
              setQuantos(POR_VEZ);
            }}
            placeholder="Buscar por nome ou WhatsApp"
          />

          <TrilhoDeFiltros>
            <Filtro
              rotulo="Todos"
              conta={lista.length}
              ativo={filtro === "todos"}
              onClick={() => trocarFiltro("todos")}
            />
            {vencidos.length ? (
              <Filtro
                rotulo="Vencidas"
                conta={vencidos.length}
                alerta
                ativo={filtro === "vencidas"}
                onClick={() => trocarFiltro("vencidas")}
              />
            ) : null}
            {planosNaLista.map((nome) => (
              <Filtro
                key={nome}
                rotulo={curto(nome!)}
                conta={lista.filter((a) => a.plano === nome).length}
                ativo={filtro === nome}
                onClick={() => trocarFiltro(nome!)}
              />
            ))}
            {antigos.length ? (
              <Filtro
                rotulo="Antigos"
                conta={antigos.length}
                ativo={filtro === "antigos"}
                onClick={() => trocarFiltro("antigos")}
              />
            ) : null}
          </TrilhoDeFiltros>
        </div>
      ) : null}

      {lista.length === 0 ? (
        <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-10 text-center text-sm text-texto-suave">
          Nenhum assinante ainda. Coloque o primeiro pelo botão acima, é o
          WhatsApp dele que liga tudo.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-10 text-center text-sm text-texto-suave">
          Ninguém encontrado com esse nome ou número.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {mostrando.map((a) => (
            /* Empilhado, e não em wrap. Em 360px a linha única espremia nome,
               plano, telefone, valor e quatro botões na mesma faixa. */
            <li
              key={a.id}
              className={`flex flex-col gap-3 rounded-card border px-4 py-3 ${
                a.status === "vencida"
                  ? "border-alerta/40 bg-superficie-ativa"
                  : "border-borda bg-superficie-ativa"
              }`}
            >
              {/* O preço divide linha só com o nome. Junto das três linhas, o
                  telefone herdava a largura sobrando e cortava em 360px. */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-titulo text-sm font-semibold">
                    <Crown
                      className={`h-3.5 w-3.5 shrink-0 ${
                        a.status === "vencida" ? "text-alerta" : "text-clube"
                      }`}
                      strokeWidth={2.5}
                    />
                    <span className="truncate">{a.nome}</span>
                  </span>

                  <span className="num shrink-0 font-titulo text-base font-bold">
                    {moedaCentavos(a.precoCentavos)}
                  </span>
                </div>

                {a.plano ? (
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-xs text-texto-suave">
                      {a.plano}
                    </span>
                    {ehAntigo(a.planoDias) ? (
                      <span className="shrink-0 rounded-pill bg-clube px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-fundo">
                        até sáb
                      </span>
                    ) : null}
                  </span>
                ) : null}

                <span
                  className={`num text-xs ${
                    a.status === "vencida" ? "text-alerta" : "text-texto-apagado"
                  }`}
                >
                  {telefoneBonito(a.telefone)} ·{" "}
                  {a.status === "vencida"
                    ? `venceu ${dia(a.proximaCobranca)}`
                    : `até ${dia(a.cicloFim)}`}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <ChaveDoCliente
                  clienteId={a.clienteId}
                  nome={a.nome}
                  telefone={a.telefone}
                  chave={a.chave}
                />

                <Recebi assinaturaId={a.id} vencida={a.status === "vencida"} />

                {a.status === "vencida" ? (
                  <AvisoWhatsapp
                    telefone={a.telefone}
                    texto={textoDe("mensalidade_vencida", {
                      cliente: a.nome.split(" ")[0],
                      quando: dia(a.proximaCobranca),
                      valor: moedaCentavos(a.precoCentavos),
                      pix: pixKey,
                    })}
                  />
                ) : null}

                <Tirar assinaturaId={a.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {lista.length > 8 ? (
        <VerMais
          mostrando={mostrando.length}
          total={filtrados.length}
          geral={lista.length}
          onMais={() => setQuantos((n) => n + POR_VEZ)}
        />
      ) : null}

      {vencidos.length ? (
        <p className="text-xs text-alerta">
          {vencidos.length} mensalidade(s) vencida(s). Enquanto está vencida, o
          cliente não gasta crédito, o corte sai avulso.
        </p>
      ) : null}

      <p className="text-xs text-texto-apagado">
        O WhatsApp é a identidade. Assim que ele digitar esse número no
        agendamento, o plano aparece sozinho para ele. O link de acesso é outra
        coisa: serve para ver os próprios horários em &ldquo;Sou do clube&rdquo;.
      </p>
    </section>
  );
}

function Inscrever({
  planos,
  onPronto,
}: {
  planos: PlanoDoPainel[];
  onPronto: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [planoId, setPlanoId] = useState(planos[0]?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, comecar] = useTransition();

  const campo =
    "min-h-toque w-full rounded-bloco border border-borda bg-superficie px-3 text-sm text-texto placeholder:text-texto-apagado";
  const valido =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, "").length >= 10 &&
    Boolean(planoId);

  return (
    <div className="flex flex-col gap-3 rounded-card border border-borda-forte bg-superficie-ativa p-4">
      <span className="text-sm text-texto-suave">
        Se ele já cortou aqui alguma vez, a assinatura cola no cadastro que já
        existe, basta o mesmo número.
      </span>

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do assinante"
          className={campo}
        />
        <input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(84) 99999-9999"
          inputMode="tel"
          className={`num ${campo}`}
        />
        {/* O plano decide o preço e o que o corte cobre, então ele é escolha,
            não detalhe: sem isso o Johny cadastraria todo mundo no mesmo. */}
        <select
          value={planoId}
          onChange={(e) => setPlanoId(e.target.value)}
          className={campo}
          aria-label="Plano do clube"
        >
          {planos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} · {moedaCentavos(p.preco_centavos)}
            </option>
          ))}
        </select>
      </div>

      {erro ? <span className="text-xs text-alerta">{erro}</span> : null}

      <button
        type="button"
        disabled={!valido || rodando}
        onClick={() =>
          comecar(async () => {
            const r = await inscreverNoClube({ nome, telefone, planoId });
            if (r.erro) setErro(r.erro);
            else {
              setNome("");
              setTelefone("");
              onPronto();
            }
          })
        }
        className={`${pill} sm:self-start ${
          valido && !rodando
            ? "bg-acao text-acao-sobre hover:bg-acao-hover"
            : "cursor-not-allowed border border-borda bg-superficie-apagada text-texto-apagado"
        }`}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        {rodando ? "Cadastrando..." : "Colocar no clube"}
      </button>
    </div>
  );
}

/**
 * Chave do assinante: é com ela que ele abre a área do clube.
 *
 * Aparece uma vez só, como a do barbeiro. Gerar de novo derruba a anterior, o
 * que resolve o caso comum de o cliente ter perdido a mensagem.
 */
function ChaveDoCliente({
  clienteId,
  nome,
  telefone,
  chave,
}: {
  clienteId: string;
  nome: string;
  telefone: string;
  chave: Assinante["chave"];
}) {
  const [rodando, comecar] = useTransition();
  const [nova, setNova] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (nova) {
    /**
     * O link já leva a chave dentro. É a diferença entre o cliente decorar
     * oito caracteres e simplesmente tocar no que chegou no WhatsApp.
     */
    const link =
      typeof window === "undefined"
        ? ""
        : `${window.location.origin}/entrar?c=${nova}`;

    const recado = `Oi ${nome.split(" ")[0]}! Esse link abre sua área do Clube Johny, é só tocar:
${link}

Dá para ver seus horários e marcar sem pagar nada. Guarda essa mensagem, o link continua valendo.`;

    return (
      <div className="flex w-full flex-col gap-3 rounded-card border border-acao/50 bg-superficie p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-texto-apagado">
            Acesso de {nome.split(" ")[0]}
          </span>
          <span className="num font-titulo text-2xl font-bold tracking-wide text-acao">
            {nova}
          </span>
          <span className="break-all text-xs text-texto-suave">{link}</span>
        </div>
        <p className="text-xs text-alerta">
          Mande agora: isso não aparece de novo. Se ele perder, gere outro e o
          anterior para de valer na hora.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <BotaoCopiar valor={link} rotulo="Copiar link" destaque />
          <a
            href={`https://wa.me/${telefone.replace(/\D/g, "").replace(/^(?!55)/, "55")}?text=${encodeURIComponent(recado)}`}
            target="_blank"
            rel="noreferrer"
            className={`${pill} border border-borda-forte text-texto hover:border-acao`}
          >
            Mandar no WhatsApp
          </a>
          <button
            type="button"
            onClick={() => setNova(null)}
            className={`${pill} text-texto-suave hover:text-texto`}
          >
            Já mandei
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={rodando}
      onClick={() =>
        comecar(async () => {
          const r = await gerarChaveCliente(clienteId);
          if (r.erro) setErro(r.erro);
          else if (r.chave) {
            setErro(null);
            setNova(r.chave);
          }
        })
      }
      title={
        chave
          ? `Acesso ${chave.prefixo}···· ${
              chave.ultimoAcesso ? "já usado por ele" : "ainda não usado"
            }. Gerar outro derruba esse.`
          : "Gera o link de acesso dele à área do clube"
      }
      className={`${pill} shrink-0 border text-texto disabled:opacity-60 ${
        erro
          ? "border-alerta text-alerta"
          : "border-borda-forte hover:border-acao"
      }`}
    >
      <KeyRound className="h-4 w-4" strokeWidth={2} />
      {rodando ? "..." : erro ? "Deu erro" : chave ? "Novo link" : "Gerar link"}
    </button>
  );
}

/** Recebeu a mensalidade no pix ou na mão: empurra o ciclo um mês. */
function Recebi({
  assinaturaId,
  vencida,
}: {
  assinaturaId: string;
  vencida: boolean;
}) {
  const [rodando, comecar] = useTransition();

  return (
    <button
      type="button"
      disabled={rodando}
      onClick={() => comecar(() => registrarMensalidade(assinaturaId).then(() => {}))}
      title="Registra o pagamento e renova o ciclo por um mês"
      className={`${pill} shrink-0 ${
        vencida
          ? "bg-acao text-acao-sobre hover:bg-acao-hover"
          : "border border-borda-forte text-texto hover:border-acao"
      } disabled:opacity-60`}
    >
      <Check className="h-4 w-4" strokeWidth={2.5} />
      {rodando ? "..." : "Recebi o mês"}
    </button>
  );
}

function Tirar({ assinaturaId }: { assinaturaId: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [rodando, comecar] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-toque shrink-0 items-center rounded-pill border border-borda px-3 font-titulo text-sm font-semibold text-texto-suave transition-colors hover:border-alerta hover:text-alerta"
      >
        Excluir
      </button>
    );
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={rodando}
        onClick={() => comecar(() => cancelarAssinatura(assinaturaId).then(() => {}))}
        className={`${pill} border border-alerta/60 text-alerta hover:bg-alerta/10`}
      >
        Excluir mesmo
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className={`${pill} border border-borda-forte text-texto`}
      >
        Deixa
      </button>
    </div>
  );
}
