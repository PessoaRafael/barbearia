import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Crown, MessageCircle } from "lucide-react";

import { Logo, Secao } from "@/componentes/base";
import { EstaAberto } from "@/componentes/site/EstaAberto";
import { ModalClube } from "@/componentes/site/ModalClube";
import { Vitrine } from "@/componentes/site/Vitrine";
import {
  barbeirosAtivos,
  casa,
  diasEmTexto,
  planoMaisEscolhido,
  planosDoClube,
  servicosAtivos,
  type PlanoClube,
} from "@/lib/dados/casa";
import { Expediente, OndeFica, Redes } from "@/componentes/site/OndeFica";
import { agoraNaCasa, hojeNaCasa } from "@/lib/agenda/dias";
import { cartaoLigado } from "@/lib/payments/stripe";
import { CASA, estadoDaCasa } from "@/lib/casa";
import { moedaCentavos } from "@/lib/formato";

/**
 * A vitrine sai do banco: preço editado no painel muda aqui sem deploy.
 * Dez minutos de cache porque serviço e equipe mudam raramente, e o painel
 * derruba esse cache na hora que salva.
 */
export const revalidate = 600;

export default async function Landing() {
  const [barbearia, servicos, barbeiros, planos, maisEscolhido] =
    await Promise.all([
      casa(),
      servicosAtivos(),
      barbeirosAtivos(),
      planosDoClube(),
      planoMaisEscolhido(),
    ]);

  /**
   * O estado da casa já sai pronto do servidor para a primeira pintura não
   * ter buraco. O componente refaz a conta no navegador logo em seguida.
   */
  const [ano, mes, dia] = hojeNaCasa().split("-").map(Number);
  const aberto = estadoDaCasa(
    new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay(),
    agoraNaCasa(),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Cabecalho nome={barbearia.nome} cidade={barbearia.cidade} />

      <main className="flex flex-1 flex-col gap-16 px-5 pb-20 pt-8 sm:gap-24 sm:px-8 sm:pt-12 lg:px-10">
        <Hero aberto={aberto} />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 sm:gap-24">
          <Servicos servicos={servicos} />
          <Clube planos={planos} maisEscolhido={maisEscolhido} />
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
          {/* No celular vira só a coroa: três botões com texto não cabem em
              360px sem espremer o nome da casa. */}
          <Link
            href="/entrar"
            aria-label="Sou do clube"
            title="Sou do clube"
            className="inline-flex min-h-toque min-w-toque items-center justify-center gap-2 rounded-pill border border-clube/50 px-3 font-titulo text-sm font-semibold text-clube transition-colors hover:border-clube sm:px-4"
          >
            <Crown className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span className="hidden sm:inline">Sou do clube</span>
          </Link>
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

/**
 * O topo.
 *
 * Tinha a marca em 96px logo abaixo da mesma marca em 40px no cabeçalho, e uma
 * tira de três números onde só o primeiro dizia alguma coisa — "3 barbeiros" e
 * "18 serviços" enchiam a linha sem convencer ninguém. Os dois saíram.
 *
 * No lugar entrou o que a pessoa que chega pelo Instagram no meio da tarde
 * realmente quer saber: se está aberto agora.
 */
function Hero({ aberto }: { aberto: ReturnType<typeof estadoDaCasa> }) {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
      <div className="flex flex-col items-start gap-6">
        <EstaAberto inicial={aberto} />

        <div className="flex flex-col gap-4">
          <h1 className="text-4xl leading-[1.04] sm:text-5xl">
            Sua cadeira marcada em menos de um minuto
          </h1>
          <p className="max-w-md text-lg text-texto-suave">
            Escolhe o serviço, quem corta e a hora. Sem ligação e sem esperar
            resposta no WhatsApp.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
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

        {/* A prova que sobrou da tira de números, agora numa linha só: o
            número que o Johny tem na cabeça, e onde fica a casa. */}
        <p className="text-sm text-texto-apagado">
          <span className="num font-titulo font-semibold text-texto-medio">
            {CASA.atendimentos} atendimentos
          </span>{" "}
          na {CASA.bairro}, em {CASA.cidade.split(",")[0]}.
        </p>
      </div>

      <Fachada />
    </section>
  );
}

/**
 * A foto do Johny, tratada como foto e não como ilustração num quadrado.
 *
 * O brilho atrás e o degradê na base dão profundidade a uma página que é
 * inteira feita de cartões chapados sobre o mesmo fundo. A legenda existe
 * porque a foto sem nome não diz a ninguém quem é aquele homem.
 */
function Fachada() {
  return (
    <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[380px] lg:mx-0 lg:max-w-[420px] lg:justify-self-end">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-pill bg-acao/10 blur-3xl"
      />
      <div
        className="relative overflow-hidden rounded-grande border border-borda-media bg-superficie-ativa"
        style={{ aspectRatio: "3 / 4" }}
      >
        <Image
          src="/Johny.jpg"
          alt="Johny, da Johny Barbearia"
          fill
          sizes="(min-width: 1024px) 420px, (min-width: 640px) 380px, 90vw"
          /* Ancorado no topo: o box é mais quadrado que a foto, e cortar pelo
             meio comeria a cabeça de quem está posando. */
          className="object-cover object-top"
          priority
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-fundo via-fundo/60 to-transparent"
        />
        <div className="absolute inset-x-4 bottom-4 flex flex-col">
          <span className="font-titulo text-base font-bold text-texto">Johny</span>
          <span className="text-xs text-texto-suave">dono da casa</span>
        </div>
      </div>
    </div>
  );
}

type ServicoDb = Awaited<ReturnType<typeof servicosAtivos>>[number];

function Servicos({ servicos }: { servicos: ServicoDb[] }) {
  return (
    <Secao
      id="servicos"
      titulo="O que a gente faz"
      apoio="Preço fechado, sem surpresa na hora de pagar."
    >
      <Vitrine
        servicos={servicos.map((s) => ({
          id: s.id,
          nome: s.nome,
          categoria: s.categoria,
          duracaoMin: s.duracao_min,
          precoCentavos: s.preco_centavos,
          tag: s.tag,
        }))}
      />
    </Secao>
  );
}

/**
 * Os planos.
 *
 * Eram três cartões do mesmo peso, e três opções iguais não ajudam ninguém a
 * escolher. Agora o mais assinado vem destacado — e quem diz qual é são os
 * assinantes, não a gente: o número sai da tabela de assinaturas vivas.
 */
function Clube({
  planos,
  maisEscolhido,
}: {
  planos: PlanoClube[];
  maisEscolhido: string | null;
}) {
  return (
    <Secao
      id="clube"
      titulo="Clube Johny"
      apoio="Paga uma vez no mês e vem quantas vezes quiser."
    >
      {/* A seção fica em pé mesmo sem plano nenhum. Sumir com ela levava junto
          o id="clube", e aí o botão "Conhecer o clube" lá em cima virava um
          clique que não faz nada: o defeito aparecia longe da causa. */}
      {planos.length === 0 ? (
        <p className="rounded-grande border border-borda bg-superficie px-5 py-8 text-center text-sm text-texto-suave">
          Os planos estão sendo atualizados. Chame o Johny no WhatsApp que ele
          te passa os valores na hora.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="grid gap-4 lg:grid-cols-3">
            {planos.map((plano) => (
              <CartaoDoPlano
                key={plano.id}
                plano={plano}
                destaque={plano.id === maisEscolhido}
              />
            ))}
          </ul>

          <p className="text-sm text-texto-suave">
            Já é do clube?{" "}
            <Link
              href="/entrar"
              className="font-titulo font-semibold text-clube underline underline-offset-4 hover:text-texto"
            >
              Entre com seu link
            </Link>{" "}
            e marque sem pagar nada na hora.
          </p>
        </div>
      )}
    </Secao>
  );
}

function CartaoDoPlano({
  plano,
  destaque,
}: {
  plano: PlanoClube;
  destaque: boolean;
}) {
  return (
    <li
      className={`relative flex h-full flex-col gap-5 rounded-grande border p-5 ${
        destaque
          ? "border-acao/50 bg-superficie-ativa"
          : "border-borda bg-superficie"
      }`}
    >
      {destaque ? (
        <span className="absolute -top-3 left-5 rounded-pill bg-acao px-3 py-0.5 font-titulo text-xs font-bold uppercase tracking-wide text-acao-sobre">
          o mais escolhido
        </span>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className="font-titulo text-lg font-bold">{plano.nome}</span>
        <div className="flex items-end gap-1">
          <span className="num font-titulo text-4xl font-bold text-acao">
            {moedaCentavos(plano.preco_centavos)}
          </span>
          <span className="pb-1.5 text-sm text-texto-suave">/mês</span>
        </div>
      </div>

      <ul className="flex flex-col gap-2.5">
        <Beneficio>
          {plano.cobre_categorias.join(" e ").toLowerCase()} sem limite de vezes
        </Beneficio>
        {/* O dia é a regra que mais gera discussão na cadeira, então ela
            aparece no cartão, não numa nota de rodapé. */}
        <Beneficio>atendimento de {diasEmTexto(plano.dias_semana)}</Beneficio>
        <Beneficio>cancela quando quiser, sem multa</Beneficio>
      </ul>

      {/* Empurrado para a base: os cartões têm textos de tamanhos
          diferentes, e botão flutuando em altura diferente em cada um é a
          primeira coisa que denuncia grade montada no olho. */}
      <div className="mt-auto pt-1">
        <ModalClube
          planoId={plano.id}
          plano={plano.nome}
          preco={moedaCentavos(plano.preco_centavos)}
          dias={diasEmTexto(plano.dias_semana)}
          destaque={destaque}
          beneficios={[
            `${plano.cobre_categorias.join(" e ")} sem limite de vezes`,
            `Atendimento de ${diasEmTexto(plano.dias_semana)}`,
            "Escolhe o horário e o barbeiro, como qualquer cliente",
            "Cancela quando quiser, sem multa",
          ]}
          cartaoDisponivel={cartaoLigado()}
        />
      </div>
    </li>
  );
}

function Beneficio({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-clube" strokeWidth={2.5} />
      <span className="text-sm text-texto-medio">{children}</span>
    </li>
  );
}

/**
 * A equipe.
 *
 * O nome saiu de baixo da foto e foi para dentro dela. Numa barbearia a foto é
 * o argumento, e o cartão anterior gastava metade da altura com uma tesoura
 * decorativa repetida três vezes.
 */
function Time({
  barbeiros,
}: {
  barbeiros: Awaited<ReturnType<typeof barbeirosAtivos>>;
}) {
  return (
    <Secao
      id="time"
      titulo="Quem corta"
      apoio="Os três fazem tudo, do corte à química. Escolhe quem você prefere ou deixa com o primeiro que liberar."
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {barbeiros.map((barbeiro) => (
          <li
            key={barbeiro.id}
            /* 3/4 e não 4/3: as fotos da equipe são em pé, e no box deitado o
               corte comia a cabeça de todo mundo. */
            className="relative flex items-end overflow-hidden rounded-grande border border-borda bg-superficie-ativa"
            style={{ aspectRatio: "3 / 4" }}
          >
            {barbeiro.foto_url ? (
              <Image
                src={barbeiro.foto_url}
                alt={barbeiro.nome}
                fill
                sizes="(min-width: 640px) 320px, 100vw"
                className="object-cover object-top"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center font-titulo text-4xl font-bold text-texto-apagado">
                {barbeiro.apelido.slice(0, 2).toUpperCase()}
              </span>
            )}

            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-fundo via-fundo/70 to-transparent"
            />

            <div className="relative flex w-full flex-col gap-0.5 p-4">
              <span className="font-titulo text-lg font-bold leading-tight">
                {barbeiro.nome}
              </span>
              <span className="text-sm text-texto-suave">
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
      {/* O buraco no rodapé era vertical, não horizontal: o cartão do mapa
          tinha 600px de altura ao lado de colunas de 150. A saída foi
          espalhar o conteúdo — horário saiu do cartão e foi para o meio, as
          redes desceram para baixo do nome — em vez de espremer as colunas. */}
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto_auto_minmax(300px,340px)] lg:gap-10 lg:px-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Logo tamanho={40} />
            <span className="font-titulo text-base font-bold">{CASA.nome}</span>
          </div>
          <p className="max-w-xs text-sm text-texto-suave">
            Fica na Nova Descoberta, em Natal. Marque o horário pelo site e
            chegue na hora: a cadeira já está no seu nome.
          </p>
          <p className="num text-sm text-texto-apagado">
            {CASA.atendimentos} atendimentos
          </p>
          <Redes />
        </div>

        <nav className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-texto-apagado">
            Atalhos
          </h3>
          <ul className="flex flex-col gap-2.5 text-sm">
            {[
              { href: "/agendar", texto: "Marcar horário" },
              { href: "/bot", texto: "Marcar pelo chat" },
              { href: "#servicos", texto: "Serviços e preços" },
              { href: "#time", texto: "Quem corta" },
              { href: "#clube", texto: "Clube de assinatura" },
              { href: "/entrar", texto: "Sou do clube" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-texto-suave transition-colors hover:text-acao"
                >
                  {l.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Expediente />

        <OndeFica />
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
