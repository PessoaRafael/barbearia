import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Scissors,
} from "lucide-react";

import { Etiqueta, Logo, Retrato, Secao } from "@/componentes/base";
import { ModalClube } from "@/componentes/site/ModalClube";
import { barbeirosAtivos, casa, servicosAtivos } from "@/lib/dados/casa";
import { CASA } from "@/lib/casa";
import { moedaCentavos } from "@/lib/formato";

/**
 * A vitrine sai do banco: preço editado no painel muda aqui sem deploy.
 * Dez minutos de cache porque serviço e equipe mudam raramente, e o painel
 * derruba esse cache na hora que salva.
 */
export const revalidate = 600;

export default async function Landing() {
  const [barbearia, servicos, barbeiros] = await Promise.all([
    casa(),
    servicosAtivos(),
    barbeirosAtivos(),
  ]);

  const numeros = [
    { valor: barbeiros.length, rotulo: "barbeiros na casa" },
    { valor: servicos.length, rotulo: "serviços na régua" },
    {
      valor: barbearia.clube_cortes_mes === 0 ? "∞" : barbearia.clube_cortes_mes,
      rotulo: "cortes no clube",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Cabecalho nome={barbearia.nome} cidade={barbearia.cidade} />

      <main className="flex flex-1 flex-col gap-16 px-5 pb-20 pt-8 sm:gap-20 sm:px-8 sm:pt-12 lg:px-10">
        <Hero numeros={numeros} />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 sm:gap-20">
          <Servicos servicos={servicos} />
          <Clube
            precoCentavos={barbearia.clube_preco_centavos}
            ilimitado={barbearia.clube_cortes_mes === 0}
            cortes={barbearia.clube_cortes_mes}
          />
          <Time barbeiros={barbeiros} />
        </div>
      </main>

      <Rodape />
    </div>
  );
}

function Cabecalho({ nome, cidade }: { nome: string; cidade: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 py-3 sm:px-8 lg:px-10">
        <Logo tamanho={40} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-titulo text-base font-bold leading-tight">
            {nome}
          </span>
          <span className="truncate text-xs text-texto-suave">{cidade}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/bot"
            className="inline-flex min-h-toque items-center gap-2 rounded-pill border border-borda-forte px-4 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">Marcar pelo chat</span>
            <span className="sm:hidden">Chat</span>
          </Link>
          <Link
            href="/agendar"
            className="inline-flex min-h-toque items-center rounded-pill bg-acao px-4 font-titulo text-sm font-semibold text-acao-sobre transition-colors hover:bg-acao-hover sm:px-6"
          >
            Agendar
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({
  numeros,
}: {
  numeros: { valor: string | number; rotulo: string }[];
}) {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12">
      <div className="flex flex-col gap-6">
        <Logo tamanho={96} />

        <div className="flex flex-col gap-3">
          <h1 className="text-4xl leading-[1.05] sm:text-5xl">
            Sua cadeira marcada em menos de um minuto
          </h1>
          <p className="max-w-lg text-lg text-texto-suave">
            Escolhe o serviço, escolhe quem corta, escolhe a hora. Sem ligação,
            sem lista de espera, sem ficar esperando resposta no aplicativo de
            mensagem.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/agendar"
            className="inline-flex min-h-toque items-center justify-center gap-2 rounded-pill bg-acao px-6 font-titulo text-base font-semibold text-acao-sobre transition-colors hover:bg-acao-hover"
          >
            Agendar horário
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Link>
          <a
            href="#clube"
            className="inline-flex min-h-toque items-center justify-center rounded-pill border border-borda-forte px-6 font-titulo text-base font-semibold text-texto transition-colors hover:border-acao"
          >
            Conhecer o clube
          </a>
        </div>

        <dl className="grid grid-cols-3 gap-3 border-t border-borda pt-6">
          {numeros.map((n) => (
            <div key={n.rotulo} className="flex flex-col-reverse gap-1">
              <dt className="text-xs text-texto-suave">{n.rotulo}</dt>
              <dd className="num font-titulo text-3xl font-bold text-texto">
                {n.valor}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Nativa em 710x679: o box acompanha o quadrado da foto e nunca passa
          de 420px, para não esticar pixel que não existe. */}
      <Retrato
        src="/salao.jpg"
        alt="Johny e o sócio na Johny Barbearia"
        tamanhos="(min-width: 1024px) 420px, 100vw"
        proporcao="710 / 679"
        className="w-full max-w-[420px] self-center lg:justify-self-end"
      />
    </section>
  );
}

type ServicoDb = Awaited<ReturnType<typeof servicosAtivos>>[number];

function Servicos({ servicos }: { servicos: ServicoDb[] }) {
  const categorias = [...new Set(servicos.map((s) => s.categoria))];

  return (
    <Secao
      id="servicos"
      titulo="O que a gente faz"
      apoio="Preço fechado, sem surpresa na hora de pagar."
    >
      <div className="flex flex-col gap-6">
        {categorias.map((categoria) => {
          const lista = servicos.filter((s) => s.categoria === categoria);
          return (
            <div key={categoria} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-texto-apagado">
                {categoria}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {lista.map((servico) => (
                  <li
                    key={servico.id}
                    className="flex items-center gap-4 rounded-card border border-borda bg-superficie p-4"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-titulo text-base font-semibold">
                          {servico.nome}
                        </span>
                        {servico.coberto_pelo_clube ? (
                          <Etiqueta tom="clube">no clube</Etiqueta>
                        ) : null}
                        {servico.tag ? (
                          <Etiqueta tom="neutro">{servico.tag}</Etiqueta>
                        ) : null}
                      </div>
                      <span className="num text-xs text-texto-suave">
                        {servico.duracao_min} min
                      </span>
                    </div>
                    <span className="num font-titulo text-lg font-bold text-acao">
                      {moedaCentavos(servico.preco_centavos)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Secao>
  );
}

function Clube({
  precoCentavos,
  ilimitado,
  cortes,
}: {
  precoCentavos: number;
  ilimitado: boolean;
  cortes: number;
}) {
  const beneficios = ilimitado
    ? [
        "Corte quantas vezes quiser, sem limite no mês",
        "Escolhe o horário e o barbeiro, como qualquer cliente",
        "Cancela quando quiser, sem multa",
      ]
    : [
        `${cortes} cortes por mês, na hora que der`,
        "Escolhe o horário e o barbeiro, como qualquer cliente",
        "Cancela quando quiser, sem multa",
      ];

  return (
    <Secao
      id="clube"
      titulo="Clube Johny"
      apoio="Para quem corta sempre e não quer pensar em pagamento toda semana."
    >
      <div className="grid gap-4 rounded-grande border border-borda bg-superficie p-5 sm:p-7 lg:grid-cols-[auto_1fr] lg:gap-10">
        <div className="flex flex-col gap-1">
          <div className="flex items-end gap-1">
            <span className="num font-titulo text-5xl font-bold text-acao">
              {moedaCentavos(precoCentavos)}
            </span>
            <span className="pb-2 text-sm text-texto-suave">/mês</span>
          </div>
          <span className="num text-sm text-clube">
            {ilimitado ? "corte à vontade" : `${cortes} cortes por mês`}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {beneficios.map((beneficio) => (
              <li key={beneficio} className="flex items-start gap-3">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-clube"
                  strokeWidth={2.5}
                />
                <span className="text-texto-medio">{beneficio}</span>
              </li>
            ))}
          </ul>
          <ModalClube
            preco={moedaCentavos(precoCentavos)}
            cortes={cortes}
            beneficios={beneficios}
          />
        </div>
      </div>
    </Secao>
  );
}

function Time({
  barbeiros,
}: {
  barbeiros: Awaited<ReturnType<typeof barbeirosAtivos>>;
}) {
  return (
    <Secao
      id="time"
      titulo="Quem corta"
      apoio="Cada um com a mão em uma coisa. Dá para escolher ou deixar com o primeiro que liberar."
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {barbeiros.map((barbeiro) => (
          <li
            key={barbeiro.id}
            className="flex flex-col gap-3 rounded-card border border-borda bg-superficie p-4"
          >
            <Retrato
              src={barbeiro.foto_url ?? undefined}
              alt={barbeiro.nome}
              iniciais={barbeiro.apelido.slice(0, 2).toUpperCase()}
              tamanhos="(min-width: 640px) 320px, 100vw"
              proporcao="4 / 3"
            />
            <div className="flex flex-col gap-1">
              <span className="font-titulo text-lg font-semibold">
                {barbeiro.nome}
              </span>
              <span className="flex items-center gap-2 text-sm text-texto-suave">
                <Scissors className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {barbeiro.especialidade}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Secao>
  );
}

function Rodape() {
  return (
    <footer className="border-t border-borda bg-superficie">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 lg:flex-row lg:justify-between lg:px-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Logo tamanho={40} />
            <span className="font-titulo text-base font-bold">{CASA.nome}</span>
          </div>
          <span className="flex items-start gap-2 text-sm text-texto-suave">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="flex flex-col">
              {CASA.endereco}
              <span className="num">
                {CASA.cidade} · CEP {CASA.cep}
              </span>
            </span>
          </span>
          <span className="num flex items-center gap-2 text-sm text-texto-suave">
            <Phone className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {CASA.telefone}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-texto-apagado">
            <Clock className="h-4 w-4" strokeWidth={1.75} />
            Horário de funcionamento
          </h3>
          <ul className="flex flex-col gap-2">
            {CASA.expediente.map((linha) => (
              <li
                key={linha.dia}
                className="flex items-baseline justify-between gap-8 text-sm lg:min-w-[320px]"
              >
                <span className="text-texto-medio">{linha.dia}</span>
                <span className="num text-texto-suave">{linha.horario}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-borda">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-texto-apagado sm:px-8 lg:px-10">
          <span>{CASA.nome}</span>
          <Link href="/painel" className="hover:text-texto-suave">
            Painel do barbeiro
          </Link>
        </div>
      </div>
    </footer>
  );
}
