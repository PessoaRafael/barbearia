import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Crown,
  KeyRound,
  Scissors,
  Settings,
  Timer,
  Users,
  Wallet,
} from "lucide-react";

import { Logo } from "@/componentes/base";
import {
  AvisoWhatsapp,
  DecidirPix,
  EncerrarAtendimento,
  GerarChave,
  RevogarChave,
  SoltarBloqueio,
} from "@/componentes/painel/Acoes";
import { Configuracoes } from "@/componentes/painel/Configuracoes";
import { sair } from "@/app/entrar/acoes";
import { lerSessao } from "@/lib/auth/sessao";
import { hojeNaCasa, proximosDias, rotuloDe } from "@/lib/agenda/dias";
import { casa } from "@/lib/dados/casa";
import {
  agendaDoDia,
  assinantes,
  avisosPendentes,
  bloqueiosDoDia,
  caixaDoDia,
  clientes,
  equipe,
  pixParaConferir,
  resumoDoDia,
  servicos as listarServicos,
} from "@/lib/dados/painel";
import { moedaCentavos, telefoneBonito } from "@/lib/formato";
import { textoDe } from "@/lib/notify/whatsapp";

export const dynamic = "force-dynamic";

const ABAS = [
  { id: "agenda", nome: "Agenda", sub: "hoje e próximos dias", icone: CalendarDays },
  { id: "pix", nome: "Pix", sub: "conferir e liberar", icone: Timer },
  { id: "clube", nome: "Clube", sub: "assinantes e cobrança", icone: Crown },
  { id: "clientes", nome: "Clientes", sub: "histórico e sumidos", icone: Users },
  { id: "servicos", nome: "Serviços", sub: "preço e duração", icone: Scissors },
  { id: "caixa", nome: "Caixa", sub: "entradas do dia", icone: Wallet },
  { id: "equipe", nome: "Equipe", sub: "chaves de acesso", icone: KeyRound },
  { id: "config", nome: "Ajustes", sub: "pix, clube e reserva", icone: Settings },
];

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
  const sessao = await lerSessao();
  if (!sessao) redirect("/entrar");
  if (sessao.papel === "barber") redirect("/agenda");

  const { aba = "agenda", dia = hojeNaCasa() } = await searchParams;
  const barbearia = await casa();
  const dias = proximosDias(7);

  const [resumo, pendentes] = await Promise.all([
    resumoDoDia(sessao, dia),
    pixParaConferir(sessao),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-5 py-3 sm:px-8 lg:px-10">
          <Logo tamanho={36} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-titulo text-base font-bold leading-tight">
              {barbearia.nome}
            </span>
            <span className="truncate text-xs text-texto-suave">
              painel do Johny
            </span>
          </div>
          <form action={sair} className="ml-auto">
            <button
              type="submit"
              className="inline-flex min-h-toque items-center rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-start lg:gap-6 lg:px-10">
        <nav className="lg:sticky lg:top-[76px] lg:w-[240px] lg:shrink-0">
          <ul className="trilho -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {ABAS.map((item) => {
              const ativo = item.id === aba;
              const Icone = item.icone;
              const conta =
                item.id === "pix" && pendentes.length ? pendentes.length : null;

              return (
                <li key={item.id} className="shrink-0 lg:shrink">
                  <Link
                    href={`/painel?aba=${item.id}`}
                    className={`flex min-h-toque w-[178px] items-center gap-3 rounded-card border px-3 py-2.5 transition-colors lg:w-full ${
                      ativo
                        ? "border-acao bg-superficie-ativa"
                        : "border-borda bg-superficie hover:border-borda-forte"
                    }`}
                  >
                    <Icone
                      className={`h-4 w-4 shrink-0 ${ativo ? "text-acao" : "text-texto-suave"}`}
                      strokeWidth={2}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-titulo text-sm font-semibold leading-tight">
                        {item.nome}
                      </span>
                      <span className="truncate text-xs text-texto-suave">
                        {item.sub}
                      </span>
                    </span>
                    {conta ? (
                      <span className="num shrink-0 rounded-pill bg-alerta px-2 py-0.5 font-titulo text-xs font-bold text-fundo">
                        {conta}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col gap-5">
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

          {aba === "agenda" ? (
            <AbaAgenda sessao={sessao} dia={dia} dias={dias} />
          ) : aba === "pix" ? (
            <AbaPix pendentes={pendentes} />
          ) : aba === "clube" ? (
            <AbaClube sessao={sessao} pix={barbearia.pix_key ?? ""} />
          ) : aba === "clientes" ? (
            <AbaClientes sessao={sessao} />
          ) : aba === "servicos" ? (
            <AbaServicos sessao={sessao} />
          ) : aba === "caixa" ? (
            <AbaCaixa sessao={sessao} dia={dia} />
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

          <AvisosNaFila sessao={sessao} />
        </main>
      </div>
    </div>
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

type Sessao = NonNullable<Awaited<ReturnType<typeof lerSessao>>>;

async function AbaAgenda({
  sessao,
  dia,
  dias,
}: {
  sessao: Sessao;
  dia: string;
  dias: ReturnType<typeof proximosDias>;
}) {
  const [marcados, bloqueios] = await Promise.all([
    agendaDoDia(sessao, dia),
    bloqueiosDoDia(sessao, dia),
  ]);

  const porBarbeiro = new Map<string, typeof marcados>();
  for (const m of marcados) {
    porBarbeiro.set(m.barbeiro, [...(porBarbeiro.get(m.barbeiro) ?? []), m]);
  }

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

      {bloqueios.length ? (
        <ul className="flex flex-col gap-2">
          {bloqueios.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center gap-3 rounded-card border border-borda-forte bg-superficie-apagada px-4 py-3"
            >
              <span className="num font-titulo text-sm font-bold">
                {b.inicio.slice(0, 5)}–{b.fim.slice(0, 5)}
              </span>
              <span className="flex-1 text-sm text-texto-suave">
                {b.motivo ?? "bloqueado"}
              </span>
              <SoltarBloqueio bloqueioId={b.id} />
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

function AbaPix({
  pendentes,
}: {
  pendentes: Awaited<ReturnType<typeof pixParaConferir>>;
}) {
  return (
    <Cartao titulo="Pix para conferir">
      <p className="text-sm text-texto-suave">
        Confira no extrato antes de liberar. O sistema nunca aceita a palavra do
        cliente — quem confirma é você.
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
                      ? "prazo vencido — o horário já voltou para a grade"
                      : `expira às ${hora(p.expiraEm!)}`}
                  </span>
                ) : null}

                <DecidirPix pagamentoId={p.id} />
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
  const vencidos = lista.filter((a) => a.status === "vencida");

  return (
    <Cartao titulo={`Clube · ${lista.length} assinantes`}>
      {lista.length === 0 ? (
        <Vazio texto="Nenhum assinante ainda. O clube aparece na landing para quem quiser entrar." />
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((a) => (
            <li
              key={a.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border px-4 py-3 ${
                a.status === "vencida"
                  ? "border-alerta/40 bg-superficie-ativa"
                  : "border-borda bg-superficie-ativa"
              }`}
            >
              <div className="flex min-w-0 flex-[1_1_55%] flex-col">
                <span className="truncate font-titulo text-sm font-semibold">
                  {a.nome}
                </span>
                <span
                  className={`num truncate text-xs ${
                    a.status === "vencida" ? "text-alerta" : "text-texto-suave"
                  }`}
                >
                  {a.status === "vencida"
                    ? `vencida em ${a.proximaCobranca}`
                    : `ciclo até ${a.cicloFim}`}
                </span>
              </div>
              <span className="num ml-auto shrink-0 font-titulo text-base font-bold">
                {moedaCentavos(a.precoCentavos)}
              </span>
              {a.status === "vencida" ? (
                <AvisoWhatsapp
                  telefone={a.telefone}
                  texto={textoDe("mensalidade_vencida", {
                    cliente: a.nome.split(" ")[0],
                    quando: a.proximaCobranca,
                    valor: moedaCentavos(a.precoCentavos),
                    pix,
                  })}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {vencidos.length ? (
        <p className="text-xs text-alerta">
          {vencidos.length} mensalidade(s) vencida(s). O botão monta a mensagem;
          quem confirma o pagamento é você.
        </p>
      ) : null}
    </Cartao>
  );
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

  return (
    <Cartao titulo={`Serviços · ${lista.length}`}>
      <ul className="flex flex-col gap-2">
        {lista.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-borda bg-superficie-ativa px-4 py-3"
          >
            <div className="flex min-w-0 flex-[1_1_55%] flex-col">
              <span className="truncate font-titulo text-sm font-semibold">
                {s.nome}
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
          </li>
        ))}
      </ul>
      <p className="text-xs text-texto-apagado">
        Editar preço e duração pela tela ainda não está pronto — por ora sai
        pelo Supabase.
      </p>
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
