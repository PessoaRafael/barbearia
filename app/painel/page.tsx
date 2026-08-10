import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AvisoWhatsapp,
  DecidirPix,
  EncerrarAtendimento,
  GerarChave,
  RevogarChave,
  SoltarBloqueio,
} from "@/componentes/painel/Acoes";
import { Bloquear } from "@/componentes/painel/Bloquear";
import { Clube } from "@/componentes/painel/Clube";
import { Configuracoes } from "@/componentes/painel/Configuracoes";
import { Servicos } from "@/componentes/painel/Servicos";
import { lerSessao, type Sessao } from "@/lib/auth/sessao";
import {
  agoraNaCasa,
  hojeNaCasa,
  proximosDias,
  rotuloDe,
} from "@/lib/agenda/dias";
import { comecoDoResto } from "@/lib/agenda/fechar";
import {
  assinantes,
  avisosPendentes,
  caixaDoDia,
  clientes,
  equipe,
  filaDeEspera,
  painelAgenda,
  pixParaConferir,
  resumoDoDia,
  servicos as listarServicos,
} from "@/lib/dados/painel";
import { moedaCentavos, telefoneBonito } from "@/lib/formato";
import { textoDe } from "@/lib/notify/textos";

export const dynamic = "force-dynamic";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function Painel({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; dia?: string }>;
}) {
  // O cabeçalho e a barra lateral moram no layout: aqui só o miolo da aba.
  //
  // O layout já barrou quem não é dono. Repetir aqui não custa outra consulta
  // (a sessão é lida uma vez por requisição) e cobre a sessão que caiu no meio
  // do caminho, mandando para /entrar em vez de estourar uma tela de erro.
  const sessao = await lerSessao();
  if (!sessao) redirect("/entrar");
  if (sessao.papel !== "owner") redirect("/entrar");

  const { aba = "agenda", dia = hojeNaCasa() } = await searchParams;
  const barbearia = sessao.casa;
  const dias = proximosDias(7);

  return (
    <>
      {/* Cada pedaco lento entra sozinho, em vez de a tela inteira esperar
          pelo mais devagar. A chave faz o Suspense recuar ao esqueleto quando
          a aba ou o dia muda, em vez de segurar o conteudo velho. */}
      <Suspense key={`n${dia}`} fallback={<IndicadoresVazios />}>
        <Indicadores sessao={sessao} dia={dia} />
      </Suspense>

      <Suspense key={`${aba}${dia}`} fallback={<Carregando />}>
        {aba === "agenda" ? (
          <AbaAgenda sessao={sessao} dia={dia} dias={dias} />
        ) : aba === "pix" ? (
          <AbaPix sessao={sessao} />
        ) : aba === "clube" ? (
          <AbaClube sessao={sessao} pix={barbearia.pix_key ?? ""} />
        ) : aba === "clientes" ? (
          <AbaClientes sessao={sessao} />
        ) : aba === "servicos" ? (
          <AbaServicos sessao={sessao} />
        ) : aba === "caixa" ? (
          <AbaCaixa sessao={sessao} dia={dia} />
        ) : aba === "fila" ? (
          <AbaFila sessao={sessao} />
        ) : aba === "equipe" ? (
          <AbaEquipe sessao={sessao} />
        ) : (
          <Configuracoes
            pixKey={barbearia.pix_key ?? ""}
            pixTitular={barbearia.pix_titular ?? ""}
            modalidade={barbearia.pagamento_modalidade}
            reservaMinutos={barbearia.reserva_minutos}
            clubePreco={barbearia.clube_preco_centavos / 100}
            clubeCortes={barbearia.clube_cortes_mes}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        <AvisosNaFila sessao={sessao} />
      </Suspense>
    </>
  );
}

async function Indicadores({ sessao, dia }: { sessao: Sessao; dia: string }) {
  const [resumo, pendentes] = await Promise.all([
    resumoDoDia(sessao, dia),
    pixParaConferir(sessao),
  ]);

  return (
    <dl className="grid grid-cols-3 gap-2 sm:gap-3">
      <Indicador rotulo="Marcados" valor={String(resumo.marcados)} />
      <Indicador
        rotulo="A receber"
        valor={moedaCentavos(resumo.receita_centavos)}
      />
      <Indicador
        rotulo="Pix pendente"
        valor={String(pendentes.length)}
        alerta={pendentes.length > 0}
      />
    </dl>
  );
}

/** Mesma altura dos números de verdade, para a tela não pular quando chegam. */
function IndicadoresVazios() {
  return (
    <dl className="grid grid-cols-3 gap-2 sm:gap-3">
      {["Marcados", "A receber", "Pix pendente"].map((rotulo) => (
        <div
          key={rotulo}
          className="flex flex-col gap-1 rounded-card border border-borda bg-superficie px-3 py-3 sm:px-4"
        >
          <dt className="text-xs text-texto-suave">{rotulo}</dt>
          <dd className="num font-titulo text-xl font-bold text-texto-apagado sm:text-2xl">
            ·
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Carregando() {
  return (
    <section className="flex min-h-[240px] items-center justify-center rounded-grande border border-borda bg-superficie p-5">
      <span className="text-sm text-texto-apagado">Carregando...</span>
    </section>
  );
}

function Indicador({
  rotulo,
  valor,
  alerta = false,
}: {
  rotulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-borda bg-superficie px-3 py-3 sm:px-4">
      <dt className="text-xs text-texto-suave">{rotulo}</dt>
      <dd
        className={`num font-titulo text-xl font-bold sm:text-2xl ${
          alerta ? "text-alerta" : "text-texto"
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}

function Cartao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4 sm:p-5">
      <h2 className="text-lg">{titulo}</h2>
      {children}
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-10 text-center text-sm text-texto-suave">
      {texto}
    </p>
  );
}


async function AbaAgenda({
  sessao,
  dia,
  dias,
}: {
  sessao: Sessao;
  dia: string;
  dias: ReturnType<typeof proximosDias>;
}) {
  const {
    marcados,
    bloqueios,
    barbeiros: time,
    janela,
  } = await painelAgenda(sessao, dia);

  const porBarbeiro = new Map<string, typeof marcados>();
  for (const m of marcados) {
    porBarbeiro.set(m.barbeiro, [...(porBarbeiro.get(m.barbeiro) ?? []), m]);
  }

  /**
   * Fechar a casa inteira grava um bloqueio por barbeiro. Mostrar os três
   * separados faria o Johny clicar em "Liberar" três vezes achando que já
   * tinha reaberto, então a mesma faixa vira uma linha só.
   */
  type Faixa = {
    inicio: string;
    fim: string;
    motivo: string | null;
    ids: string[];
    quem: string[];
  };

  const apelidoDe = new Map(time.map((b) => [b.id, b.apelido]));
  const faixas = new Map<string, Faixa>();

  for (const b of bloqueios) {
    const chave = `${b.inicio}|${b.fim}|${b.motivo ?? ""}`;
    const atual: Faixa = faixas.get(chave) ?? {
      inicio: b.inicio,
      fim: b.fim,
      motivo: b.motivo,
      ids: [],
      quem: [],
    };
    atual.ids.push(b.id);
    atual.quem.push(apelidoDe.get(b.barber_id) ?? "");
    faixas.set(chave, atual);
  }

  const fechados = [...faixas.values()].sort((a, b) =>
    a.inicio.localeCompare(b.inicio),
  );

  return (
    <Cartao titulo="Agenda do dia">
      <div className="trilho -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        {dias.map((d) => {
          const ativo = d.data === dia;
          return (
            <Link
              key={d.data}
              href={`/painel?aba=agenda&dia=${d.data}`}
              className={`inline-flex min-h-toque shrink-0 items-center rounded-pill border px-4 font-titulo text-sm font-semibold transition-colors ${
                ativo
                  ? "border-acao bg-acao text-acao-sobre"
                  : d.fechado
                    ? "border-borda bg-superficie-apagada text-texto-apagado"
                    : "border-borda bg-superficie-ativa text-texto-suave hover:border-borda-forte"
              }`}
            >
              {rotuloDe(d)}
            </Link>
          );
        })}
      </div>

      <Bloquear
        data={dia}
        janela={janela}
        barbeiros={time.map((b) => ({ id: b.id, apelido: b.apelido }))}
        apartirDe={comecoDoResto(janela, dia, hojeNaCasa(), agoraNaCasa())}
      />

      {fechados.length ? (
        <ul className="flex flex-col gap-2">
          {fechados.map((f) => (
            <li
              key={f.ids.join()}
              className="flex flex-wrap items-center gap-3 rounded-card border border-borda-forte bg-superficie-apagada px-4 py-3"
            >
              <span className="num font-titulo text-sm font-bold">
                {f.inicio.slice(0, 5)}–{f.fim.slice(0, 5)}
              </span>
              <span className="flex-1 text-sm text-texto-suave">
                {f.motivo ?? "fechado"} ·{" "}
                {f.ids.length >= time.length && time.length > 0
                  ? "a casa toda"
                  : f.quem.filter(Boolean).join(", ")}
              </span>
              <SoltarBloqueio bloqueioId={f.ids} />
            </li>
          ))}
        </ul>
      ) : null}

      {marcados.length === 0 ? (
        <Vazio texto="Nenhum agendamento nesse dia. Mande o link para o grupo." />
      ) : (
        <div className="flex flex-col gap-5">
          {[...porBarbeiro.entries()].map(([barbeiro, lista]) => (
            <div key={barbeiro} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-titulo text-base font-semibold">{barbeiro}</h3>
                <span className="num text-xs text-texto-suave">
                  {lista.length} na régua
                </span>
              </div>

              <ul className="flex flex-col gap-2">
                {lista.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-borda bg-superficie-ativa px-4 py-3"
                  >
                    <span className="num shrink-0 font-titulo text-lg font-bold">
                      {hora(m.inicio)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2 truncate font-titulo text-sm font-semibold">
                        {m.servico}
                        {m.assinante ? (
                          <span
                            className="h-2 w-2 shrink-0 rounded-pill bg-acao"
                            title="assinante do clube"
                          />
                        ) : null}
                      </span>
                      <span className="truncate text-xs text-texto-suave">
                        {m.cliente} · {telefoneBonito(m.telefone)}
                      </span>
                    </div>
                    <span className="num shrink-0 font-titulo text-base font-bold">
                      {m.usou_credito_clube && m.valor_centavos === 0
                        ? "clube"
                        : moedaCentavos(m.valor_centavos)}
                    </span>
                    {m.status === "pendente_pagamento" ? (
                      <span className="shrink-0 rounded-pill border border-alerta/50 px-3 py-1 text-xs text-alerta">
                        aguardando pix
                      </span>
                    ) : m.status === "confirmado" ? (
                      <EncerrarAtendimento agendamentoId={m.id} />
                    ) : (
                      <span className="shrink-0 text-xs text-texto-apagado">
                        {m.status}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Cartao>
  );
}

async function AbaPix({ sessao }: { sessao: Sessao }) {
  const pendentes = await pixParaConferir(sessao);

  return (
    <Cartao titulo="Pix para conferir">
      <p className="text-sm text-texto-suave">
        Confira no extrato antes de liberar. O sistema nunca aceita a palavra do
        cliente, quem confirma é você.
      </p>

      {pendentes.length === 0 ? (
        <Vazio texto="Nenhum pix pendente. Tudo conferido." />
      ) : (
        <ul className="flex flex-col gap-3">
          {pendentes.map((p) => {
            const expira = p.expiraEm ? new Date(p.expiraEm) : null;
            const venceu = expira ? expira.getTime() < Date.now() : false;

            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-card border border-borda bg-superficie-ativa p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-titulo text-base font-semibold">
                      {p.cliente}
                    </span>
                    <span className="num truncate text-xs text-texto-suave">
                      {p.servico} · {p.barbeiro} ·{" "}
                      {p.inicio ? hora(p.inicio) : ""}
                    </span>
                  </div>
                  <span className="num shrink-0 font-titulo text-xl font-bold text-acao">
                    {moedaCentavos(p.valorCentavos)}
                  </span>
                </div>

                {expira ? (
                  <span
                    className={`num text-xs ${venceu ? "text-alerta" : "text-texto-suave"}`}
                  >
                    {venceu
                      ? "prazo vencido, o horário já voltou para a grade"
                      : `expira às ${hora(p.expiraEm!)}`}
                  </span>
                ) : null}

                <DecidirPix
                  pagamentoId={p.id}
                  telefone={p.telefone}
                  aviso={textoDe("pix_confirmado", {
                    cliente: p.cliente.split(" ")[0],
                    quando: p.inicio ? hora(p.inicio) : "",
                  })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
}

async function AbaClube({ sessao, pix }: { sessao: Sessao; pix: string }) {
  const lista = await assinantes(sessao);
  return <Clube lista={lista} pixKey={pix} />;
}

async function AbaClientes({ sessao }: { sessao: Sessao }) {
  const lista = await clientes(sessao);

  return (
    <Cartao titulo={`Clientes · ${lista.length}`}>
      {lista.length === 0 ? (
        <Vazio texto="A base começa a encher no primeiro agendamento." />
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-borda bg-superficie-ativa px-4 py-3"
            >
              <div className="flex min-w-0 flex-[1_1_55%] flex-col">
                <span className="truncate font-titulo text-sm font-semibold">
                  {c.nome}
                </span>
                <span className="num truncate text-xs text-texto-suave">
                  {telefoneBonito(c.telefone)}
                  {c.faltas ? ` · ${c.faltas} falta(s)` : ""}
                </span>
              </div>
              <span className="num shrink-0 text-xs text-texto-suave">
                {c.total_cortes} cortes
              </span>
              <span className="num ml-auto shrink-0 font-titulo text-base font-bold">
                {moedaCentavos(c.total_gasto_centavos)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

async function AbaServicos({ sessao }: { sessao: Sessao }) {
  const lista = await listarServicos(sessao);
  return <Servicos lista={lista as never} />;
}

async function AbaFila({ sessao }: { sessao: Sessao }) {
  const fila = await filaDeEspera(sessao);

  return (
    <Cartao titulo={`Fila de espera · ${fila.length}`}>
      <p className="text-sm text-texto-suave">
        Quem quis um dia cheio. Quando alguém cancela, o sistema avisa esta
        fila, e aqui você chama na mão quando abrir uma brecha.
      </p>

      {fila.length === 0 ? (
        <Vazio texto="Ninguém esperando. A fila enche quando um dia lota." />
      ) : (
        <ul className="flex flex-col gap-2">
          {fila.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-borda bg-superficie-ativa px-4 py-3"
            >
              <div className="flex min-w-0 flex-[1_1_55%] flex-col">
                <span className="truncate font-titulo text-sm font-semibold">
                  {f.nome}
                </span>
                <span className="num truncate text-xs text-texto-suave">
                  {f.servico} · quer {f.data}
                  {f.barbeiro ? ` · com ${f.barbeiro}` : ""}
                </span>
              </div>
              <AvisoWhatsapp
                telefone={f.telefone}
                texto={textoDe("vaga_liberada", {
                  cliente: f.nome.split(" ")[0],
                  quando: f.data,
                  link: "johnybarbearia.com.br/agendar",
                })}
              />
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

async function AbaCaixa({ sessao, dia }: { sessao: Sessao; dia: string }) {
  const lista = await caixaDoDia(sessao, dia);
  const total = lista.reduce(
    (soma, l) => soma + (l.tipo === "entrada" ? l.valorCentavos : -l.valorCentavos),
    0,
  );

  return (
    <Cartao titulo="Caixa do dia">
      <div className="flex items-baseline justify-between gap-3 rounded-card border border-borda bg-superficie-ativa px-4 py-3">
        <span className="text-sm text-texto-suave">Entrou hoje</span>
        <span className="num font-titulo text-2xl font-bold text-acao">
          {moedaCentavos(total)}
        </span>
      </div>

      {lista.length === 0 ? (
        <Vazio texto="Nada lançado ainda. Entra automático quando um corte é concluído ou um pix é confirmado." />
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-borda bg-superficie-ativa px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-titulo text-sm font-semibold">
                  {l.categoria}
                </span>
                <span className="truncate text-xs text-texto-suave">
                  {l.descricao} {l.barbeiro ? `· ${l.barbeiro}` : ""}
                </span>
              </div>
              <span
                className={`num shrink-0 font-titulo text-base font-bold ${
                  l.tipo === "entrada" ? "text-texto" : "text-alerta"
                }`}
              >
                {l.tipo === "entrada" ? "" : "−"}
                {moedaCentavos(l.valorCentavos)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

async function AbaEquipe({ sessao }: { sessao: Sessao }) {
  const time = await equipe(sessao);

  return (
    <Cartao titulo="Equipe e chaves de acesso">
      <p className="text-sm text-texto-suave">
        O barbeiro entra em <span className="font-medium text-texto">/entrar</span>{" "}
        só com a chave. Sem e-mail, sem senha. A chave aparece uma vez: no banco
        fica só o hash.
      </p>

      <ul className="flex flex-col gap-3">
        {time.map((b) => (
          <li
            key={b.id}
            className="flex flex-col gap-3 rounded-card border border-borda bg-superficie-ativa p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-titulo text-base font-semibold">
                  {b.nome}
                </span>
                <span className="truncate text-xs text-texto-suave">
                  {b.especialidade}
                </span>
              </div>

              {b.chave ? (
                <div className="flex flex-col items-end gap-0.5">
                  <span className="num font-titulo text-sm font-bold text-texto">
                    JHNY-{b.chave.prefixo}-••••
                  </span>
                  <span className="num text-xs text-texto-suave">
                    {b.chave.ultimoAcesso
                      ? `último acesso ${new Date(b.chave.ultimoAcesso).toLocaleDateString("pt-BR")}`
                      : "nunca entrou"}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-texto-apagado">sem chave</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <GerarChave
                barbeiroId={b.id}
                nome={b.apelido}
                temChave={Boolean(b.chave)}
              />
              {b.chave ? <RevogarChave chaveId={b.chave.id} /> : null}
            </div>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

async function AvisosNaFila({ sessao }: { sessao: Sessao }) {
  const fila = await avisosPendentes(sessao);
  if (!fila.length) return null;

  return (
    <Cartao titulo={`WhatsApp na fila · ${fila.length}`}>
      <p className="text-sm text-texto-suave">
        Sem API oficial, o sistema escreve a mensagem e você dispara. Um clique
        por pessoa.
      </p>
      <ul className="flex flex-col gap-2">
        {fila.slice(0, 10).map((n) => {
          const dados = (n.payload ?? {}) as Record<string, string>;
          const texto = textoDe(n.template as never, dados);
          return (
            <li
              key={n.id}
              className="flex flex-wrap items-center gap-3 rounded-card border border-borda bg-superficie-ativa px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-titulo text-sm font-semibold">
                  {dados.cliente || "Cliente"}
                </span>
                <span className="truncate text-xs text-texto-suave">{texto}</span>
              </div>
              {n.telefone ? (
                <AvisoWhatsapp telefone={n.telefone} texto={texto} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}
