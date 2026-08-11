"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  Banknote,
  CalendarCheck,
  Crown,
  QrCode,
  Timer,
  TriangleAlert,
  Wallet,
} from "lucide-react";

import {
  buscarHorarios,
  reconhecerCliente,
  reservar,
  sessaoDoCliente,
  type Pix,
  type Reconhecido,
} from "@/app/agendar/acoes";
import { rotuloDe, type Dia } from "@/lib/agenda/dias";
import { moedaCentavos, telefoneBonito } from "@/lib/formato";
import { ComoConfirma } from "./ComoConfirma";
import { Dica } from "./Dica";
import { Passo, type EstadoPasso } from "./Passo";
import { PainelPix } from "./PainelPix";
import { PassoBarbeiro } from "./PassoBarbeiro";
import { PassoHorario } from "./PassoHorario";
import { PassoServico } from "./PassoServico";
import {
  comClube,
  duracaoLabel,
  type Barbeiro,
  type Escolha,
  type FormaPagamento,
  type Livre,
  type Servico,
} from "./tipos";

type Fechado = {
  token: string;
  status: string;
  valorCentavos: number;
  barbeiro: string;
  pix: Pix | null;
};

export function Fluxo({
  servicos,
  barbeiros,
  dias,
  clube,
  pagamentoObrigatorio,
  reservaMinutos,
}: {
  servicos: Servico[];
  barbeiros: Barbeiro[];
  dias: Dia[];
  clube: { ativo: boolean; precoCentavos: number; cortesMes: number };
  pagamentoObrigatorio: boolean;
  reservaMinutos: number;
}) {
  const primeiroAberto = dias.find((d) => !d.fechado) ?? dias[0];

  const [servicoId, setServicoId] = useState<string | null>(null);
  const [barbeiro, setBarbeiro] = useState<Escolha>(null);
  const [temBarbeiro, setTemBarbeiro] = useState(false);
  const [data, setData] = useState(primeiroAberto.data);
  const [hora, setHora] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [forma, setForma] = useState<FormaPagamento | null>(null);
  const [passoAberto, setPassoAberto] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [fechado, setFechado] = useState<Fechado | null>(null);

  const [horarios, setHorarios] = useState<Livre[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [reconhecido, setReconhecido] = useState<Reconhecido | null>(null);
  const [enviando, comecarEnvio] = useTransition();

  const servico = servicos.find((s) => s.id === servicoId) ?? null;
  const dia = dias.find((d) => d.data === data) ?? primeiroAberto;

  /**
   * Quem chegou da área do clube já está identificado: o nome e o WhatsApp
   * vêm preenchidos e o plano é reconhecido antes do primeiro clique, então a
   * régua de dias já mostra o que o plano cobre.
   *
   * Só preenche campo vazio: se a pessoa começou a digitar enquanto isso
   * respondia, o que ela escreveu manda.
   */
  useEffect(() => {
    let valeu = true;

    sessaoDoCliente()
      .then((sessao) => {
        if (!valeu || !sessao) return;
        setNome((atual) => atual || sessao.nome);
        setTelefone((atual) => atual || sessao.telefone);
        setReconhecido((atual) => atual ?? sessao.reconhecido);
      })
      .catch(() => {
        // Anônimo é o caso normal: seguir sem identificação é o esperado.
      });

    return () => {
      valeu = false;
    };
  }, []);

  /**
   * Uma consulta por (serviço, dia) traz o mapa inteiro: quem está livre em
   * cada horário. Com ele a tela monta a contagem por barbeiro e a grade,
   * sem voltar ao servidor a cada clique.
   */
  useEffect(() => {
    if (!servico) return;

    let valeu = true;
    setCarregando(true);

    buscarHorarios({ data, servicoId: servico.id })
      .then((lista) => {
        if (valeu) setHorarios(lista);
      })
      .catch(() => {
        if (valeu) setHorarios([]);
      })
      .finally(() => {
        if (valeu) setCarregando(false);
      });

    return () => {
      valeu = false;
    };
  }, [servico, data]);

  /**
   * Usar o clube depende de três coisas ao mesmo tempo: a assinatura estar em
   * dia, o serviço estar no plano e o dia da semana também. Os planos do Johny
   * valem de segunda a quinta, então sexta e sábado o assinante marca igual e
   * paga o preço cheio.
   */
  const plano = reconhecido?.plano ?? null;
  const diaEscolhido = new Date(`${data}T12:00:00-03:00`).getUTCDay();

  const planoCobre = Boolean(
    servico && plano?.categorias.includes(servico.categoria) && servico.cobertoPeloClube,
  );
  const diaDoPlano = Boolean(plano?.diasSemana.includes(diaEscolhido));

  const podeClube =
    clube.ativo &&
    Boolean(reconhecido?.assinante) &&
    planoCobre &&
    diaDoPlano &&
    (reconhecido?.creditosRestantes ?? 0) > 0;

  const valorCentavos = !servico
    ? 0
    : forma === "clube"
      ? comClube(servico)
      : servico.precoCentavos;

  const faltam = [
    servicoId,
    hora,
    temBarbeiro ? "ok" : null,
    nome.trim().length >= 2 && telefone.replace(/\D/g, "").length >= 10
      ? "ok"
      : null,
    forma,
  ].filter((v) => v === null).length;

  const nomeBarbeiro =
    fechado?.barbeiro ||
    (barbeiro === null
      ? "Primeiro que liberar"
      : (barbeiros.find((b) => b.id === barbeiro)?.nome ?? ""));

  const quando = hora ? `${rotuloDe(dia)} às ${hora}` : "";

  /** Quem está livre exatamente na hora escolhida, que é o que o passo 3 lista. */
  const livresNaHora =
    (hora ? horarios?.find((h) => h.hora === hora)?.barbeiros : null) ?? [];

  function limparDepoisDe(passo: number) {
    if (passo <= 2) setHora(null);
    if (passo <= 3) {
      setBarbeiro(null);
      setTemBarbeiro(false);
    }
    if (passo <= 4) setForma(null);
    setErro(null);
  }

  function escolherServico(id: string) {
    if (id !== servicoId) {
      limparDepoisDe(2);
      setHorarios(null);
    }
    setServicoId(id);
    setPassoAberto(2);
  }

  /** Trocar de horário devolve a escolha do barbeiro: quem estava livre às 10h
   *  pode não estar às 15h. */
  function escolherHora(valor: string) {
    setHora(valor);
    setBarbeiro(null);
    setTemBarbeiro(false);
    setForma(null);
    setPassoAberto(3);
  }

  function escolherBarbeiro(valor: Escolha) {
    setBarbeiro(valor);
    setTemBarbeiro(true);
    setForma(null);
    setPassoAberto(4);
  }

  /** O telefone é a identidade: é ele que revela o assinante. */
  async function confirmarDados() {
    const limpo = telefone.replace(/\D/g, "");
    if (nome.trim().length < 2 || limpo.length < 10) return;

    const quem = await reconhecerCliente(limpo);
    setReconhecido(quem);
    setForma(null);
    setPassoAberto(5);
  }

  function escolherForma(valor: FormaPagamento) {
    setForma(valor);
    setPassoAberto(6);
  }

  function confirmar() {
    if (!servico || !hora || !forma) return;
    setErro(null);

    comecarEnvio(async () => {
      const saida = await reservar({
        data,
        hora,
        servicoId: servico.id,
        barbeiroId: barbeiro,
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, ""),
        usarClube: forma === "clube",
        formaPagamento: forma,
      });

      if (!saida.ok) {
        setErro(saida.erro);
        // O horário pode ter sido tomado: recarrega a grade e volta ao passo 3.
        buscarHorarios({ data, servicoId: servico.id }).then(setHorarios);
        setHora(null);
        setPassoAberto(2);
        return;
      }

      setFechado(saida);
    });
  }

  function recomecar() {
    setServicoId(null);
    setBarbeiro(null);
    setTemBarbeiro(false);
    setData(primeiroAberto.data);
    setHora(null);
    setForma(null);
    setFechado(null);
    setErro(null);
    setPassoAberto(1);
  }

  const concluido = [
    Boolean(servico),
    Boolean(hora),
    temBarbeiro,
    Boolean(reconhecido !== null && nome.trim()),
    Boolean(forma),
  ];
  const travado = [
    false,
    !servico,
    !hora,
    !temBarbeiro,
    reconhecido === null,
    !forma,
  ];

  function estado(numero: number): EstadoPasso {
    if (travado[numero - 1]) return "travado";
    if (passoAberto === numero) return "aberto";
    if (numero <= 5 && concluido[numero - 1]) return "resumo";
    return "pendente";
  }

  const resumoPagamento =
    forma === "clube"
      ? valorCentavos > 0
        ? `1 corte do clube + ${moedaCentavos(valorCentavos)}`
        : "1 corte do clube"
      : forma === "pix"
        ? "Pix"
        : forma === "cadeira"
          ? "Dinheiro ou cartão na cadeira"
          : "";

  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 pb-40 pt-6 sm:px-8 lg:px-10 lg:pb-14">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">Agendar horário</h1>
          <p className="text-texto-suave">
            Um passo de cada vez. Dá para voltar em qualquer um.
          </p>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-[76px] lg:order-2 lg:w-[300px] lg:shrink-0 xl:w-[340px]">
            <CardClube clube={clube} reconhecido={reconhecido} />
            {/* Depois de fechar o agendamento a tela vira recibo, e dica de
                como escolher ali só atrapalha. */}
            {fechado ? null : <Dica passo={passoAberto} />}
            <div className="hidden lg:block">
              <Trilha
                etapas={[
                  {
                    rotulo: "Serviço",
                    valor: servico
                      ? `${servico.nome} · ${duracaoLabel(servico.duracaoMin)}`
                      : null,
                  },
                  { rotulo: "Quando", valor: hora ? quando : null },
                  { rotulo: "Quem corta", valor: temBarbeiro ? nomeBarbeiro : null },
                  { rotulo: "Seus dados", valor: reconhecido ? nome : null },
                  { rotulo: "Pagamento", valor: forma ? resumoPagamento : null },
                ]}
                total={servico ? valorCentavos : null}
              />
            </div>
          </aside>

          <div className="flex flex-1 flex-col gap-3 lg:order-1">
            {fechado && servico ? (
              <Status
                fechado={fechado}
                servico={servico}
                quando={quando}
                nome={nome}
                onRecomecar={recomecar}
              />
            ) : (
              <>
                {erro ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-card border border-alerta/50 bg-superficie px-4 py-3 text-sm text-alerta"
                  >
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                    {erro}
                  </p>
                ) : null}

                <Passo
                  numero={1}
                  titulo="Serviço"
                  estado={estado(1)}
                  resumo={
                    servico
                      ? `${servico.nome} · ${duracaoLabel(servico.duracaoMin)} · ${moedaCentavos(servico.precoCentavos)}`
                      : undefined
                  }
                  onAbrir={() => setPassoAberto(1)}
                >
                  <PassoServico
                    servicos={servicos}
                    escolhido={servico}
                    onEscolher={escolherServico}
                  />
                </Passo>

                {/* Quando antes de quem corta: com a agenda de um dia fechada,
                    perguntar o barbeiro primeiro mostrava "agenda cheia" para
                    os três sem o cliente ter escolhido dia nenhum. */}
                <Passo
                  numero={2}
                  titulo="Quando"
                  estado={estado(2)}
                  motivo="liberado depois do serviço"
                  resumo={quando}
                  onAbrir={() => setPassoAberto(2)}
                >
                  <PassoHorario
                    dias={dias}
                    dia={dia}
                    horarios={horarios}
                    carregando={carregando}
                    escolha={null}
                    hora={hora}
                    servicoId={servicoId}
                    diasDoPlano={
                      reconhecido?.assinante ? (plano?.diasSemana ?? null) : null
                    }
                    planoNome={plano?.nome ?? null}
                    onDia={(d) => {
                      setData(d);
                      setHora(null);
                      setBarbeiro(null);
                      setTemBarbeiro(false);
                      setHorarios(null);
                    }}
                    onHora={escolherHora}
                  />
                </Passo>

                <Passo
                  numero={3}
                  titulo="Quem corta"
                  estado={estado(3)}
                  motivo="liberado depois do horário"
                  resumo={nomeBarbeiro}
                  onAbrir={() => setPassoAberto(3)}
                >
                  <PassoBarbeiro
                    barbeiros={barbeiros}
                    escolha={barbeiro}
                    temEscolha={temBarbeiro}
                    dia={dia}
                    hora={hora}
                    disponiveis={livresNaHora}
                    onEscolher={escolherBarbeiro}
                  />
                </Passo>

                <Passo
                  numero={4}
                  titulo="Seus dados"
                  estado={estado(4)}
                  motivo="liberado depois do barbeiro"
                  resumo={`${nome} · ${telefoneBonito(telefone)}`}
                  onAbrir={() => setPassoAberto(4)}
                >
                  <Dados
                    nome={nome}
                    telefone={telefone}
                    onNome={setNome}
                    onTelefone={setTelefone}
                    onPronto={confirmarDados}
                  />
                </Passo>

                <Passo
                  numero={5}
                  titulo="Pagamento"
                  estado={estado(5)}
                  motivo="liberado depois dos seus dados"
                  resumo={resumoPagamento}
                  onAbrir={() => setPassoAberto(5)}
                >
                  {servico ? (
                    <Pagamento
                      servico={servico}
                      podeClube={podeClube}
                      planoCobre={planoCobre}
                      diaDoPlano={diaDoPlano}
                      quando={rotuloDe(dia)}
                      reconhecido={reconhecido}
                      obrigatorio={pagamentoObrigatorio}
                      forma={forma}
                      onEscolher={escolherForma}
                    />
                  ) : null}
                </Passo>

                <Passo
                  numero={6}
                  titulo="Confirmar"
                  estado={estado(6)}
                  motivo="liberado depois do pagamento"
                  acaoPendente="abrir"
                  onAbrir={() => setPassoAberto(6)}
                >
                  {servico && forma ? (
                    <div className="flex flex-col gap-4">
                      <p className="text-sm text-texto-medio">
                        {servico.nome} · {nomeBarbeiro} · {quando} ·{" "}
                        {resumoPagamento}
                      </p>

                      {forma === "pix" ? (
                        <p className="flex items-start gap-2 rounded-card border border-borda bg-superficie-ativa px-4 py-3 text-xs text-texto-suave">
                          <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-acao" strokeWidth={2} />
                          <span>
                            O QR e o código copia e cola aparecem aqui na hora
                            que você confirmar. Cada horário gera um código com
                            o seu valor, para o Johny achar seu pagamento no
                            extrato.
                          </span>
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={confirmar}
                        disabled={enviando}
                        className={`num inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill px-6 font-titulo text-base font-bold transition-colors ${
                          enviando
                            ? "cursor-wait border border-borda bg-superficie-apagada text-texto-apagado"
                            : "bg-acao text-acao-sobre hover:bg-acao-hover"
                        }`}
                      >
                        {enviando
                          ? "Marcando..."
                          : `Confirmar horário · ${moedaCentavos(valorCentavos)}`}
                      </button>
                    </div>
                  ) : null}
                </Passo>
              </>
            )}
          </div>
        </div>
      </main>

      {!fechado ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-superficie px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <div className="flex items-center gap-4">
            <div className="flex min-w-0 flex-col">
              <span className="text-xs text-texto-suave">Total a pagar</span>
              <span
                className={`num font-titulo text-xl font-bold ${
                  servico ? "text-acao" : "text-texto-apagado"
                }`}
              >
                {servico ? moedaCentavos(valorCentavos) : "-"}
              </span>
            </div>
            <button
              type="button"
              disabled={faltam > 0 || enviando}
              onClick={confirmar}
              className={`num inline-flex min-h-toque flex-1 items-center justify-center rounded-pill px-5 font-titulo text-base font-bold transition-colors ${
                faltam > 0 || enviando
                  ? "cursor-not-allowed border border-borda bg-superficie-apagada text-texto-apagado"
                  : "bg-acao text-acao-sobre hover:bg-acao-hover"
              }`}
            >
              {enviando ? "Marcando..." : faltam > 0 ? `falta ${faltam}` : "Confirmar"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Dados({
  nome,
  telefone,
  onNome,
  onTelefone,
  onPronto,
}: {
  nome: string;
  telefone: string;
  onNome: (v: string) => void;
  onTelefone: (v: string) => void;
  onPronto: () => void;
}) {
  const [checando, setChecando] = useState(false);
  const digitos = telefone.replace(/\D/g, "");
  const pronto = nome.trim().length >= 2 && digitos.length >= 10;

  const campo =
    "min-h-[52px] w-full rounded-card border border-borda bg-superficie-ativa px-4 text-base text-texto placeholder:text-texto-apagado";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-suave">
        Sem cadastro e sem senha. O WhatsApp serve para te avisar e, se você for
        do clube, para reconhecer seus cortes.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-texto-apagado">
          Seu nome
        </span>
        <input
          value={nome}
          onChange={(e) => onNome(e.target.value)}
          placeholder="Como te chamam"
          autoComplete="name"
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-texto-apagado">
          WhatsApp
        </span>
        <input
          value={telefone}
          onChange={(e) => onTelefone(e.target.value)}
          placeholder="(84) 99999-9999"
          inputMode="tel"
          autoComplete="tel"
          className={`num ${campo}`}
        />
      </label>

      <button
        type="button"
        disabled={!pronto || checando}
        onClick={async () => {
          setChecando(true);
          await onPronto();
          setChecando(false);
        }}
        className={`inline-flex min-h-toque items-center justify-center rounded-pill px-6 font-titulo text-base font-bold transition-colors ${
          pronto && !checando
            ? "bg-acao text-acao-sobre hover:bg-acao-hover"
            : "cursor-not-allowed border border-borda bg-superficie-apagada text-texto-apagado"
        }`}
      >
        {checando ? "Conferindo..." : "Continuar"}
      </button>
    </div>
  );
}

function Pagamento({
  servico,
  podeClube,
  planoCobre,
  diaDoPlano,
  quando,
  reconhecido,
  obrigatorio,
  forma,
  onEscolher,
}: {
  servico: Servico;
  podeClube: boolean;
  planoCobre: boolean;
  diaDoPlano: boolean;
  quando: string;
  reconhecido: Reconhecido | null;
  obrigatorio: boolean;
  forma: FormaPagamento | null;
  onEscolher: (f: FormaPagamento) => void;
}) {
  const cheio = moedaCentavos(servico.precoCentavos);
  const sobra = comClube(servico);

  return (
    <div className="flex flex-col gap-3">
      {podeClube ? (
        <Opcao
          icone={<Crown className="h-5 w-5" strokeWidth={2} />}
          titulo={`Está no seu ${reconhecido?.plano?.nome ?? "plano do clube"}`}
          apoio={
            sobra > 0
              ? `O clube cobre parte. Sobram ${moedaCentavos(sobra)} para pagar.`
              : reconhecido?.ilimitado
                ? "Você corta quantas vezes quiser. Esse não gasta nada."
                : `Sobram ${(reconhecido?.creditosRestantes ?? 1) - 1} cortes no ciclo depois desse.`
          }
          valor={moedaCentavos(sobra)}
          ativo={forma === "clube"}
          destaque
          tom="clube"
          onClick={() => onEscolher("clube")}
        />
      ) : null}

      {/* Assinante que não pôde usar o clube merece saber por quê, senão a
          conclusão dele é que o sistema esqueceu a assinatura. */}
      {!podeClube && reconhecido?.vencida ? (
        <p className="rounded-card border border-alerta/50 bg-superficie-ativa px-4 py-3 text-xs text-alerta">
          Sua mensalidade está vencida, então sai no valor normal. Fale com o
          Johny para voltar a usar o plano.
        </p>
      ) : !podeClube && reconhecido?.assinante && planoCobre && !diaDoPlano ? (
        <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-3 text-xs text-texto-suave">
          Seu plano {reconhecido.plano?.nome} vale de segunda a quinta. Como
          você escolheu {quando}, esse sai no valor normal.
        </p>
      ) : !podeClube && reconhecido?.assinante && !planoCobre ? (
        <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-3 text-xs text-texto-suave">
          Seu plano {reconhecido.plano?.nome} não cobre {servico.nome}. Esse sai
          no valor normal.
        </p>
      ) : null}

      <Opcao
        icone={<QrCode className="h-5 w-5" strokeWidth={2} />}
        titulo={
          obrigatorio ? "Pagar no pix e garantir o horário" : "Pagar no pix agora"
        }
        apoio={
          obrigatorio
            ? "A cadeira fica reservada enquanto o pix não cai. O QR aparece ao confirmar."
            : "O QR e o código copia e cola aparecem assim que você confirmar."
        }
        valor={cheio}
        ativo={forma === "pix"}
        destaque
        onClick={() => onEscolher("pix")}
      />

      {/* Com pagamento antecipado obrigatório, pagar na cadeira não existe:
          mostrar a opção só para o horário nascer pendente confundiria. */}
      {obrigatorio ? (
        <p className="rounded-card border border-borda bg-superficie-ativa px-4 py-3 text-sm text-texto-suave">
          A casa marca mediante pagamento antecipado. Não dá para acertar na
          cadeira.
        </p>
      ) : (
        <Opcao
          icone={<Banknote className="h-5 w-5" strokeWidth={2} />}
          titulo="Dinheiro ou cartão na cadeira"
          apoio="Você acerta com o barbeiro no fim do corte."
          valor={cheio}
          ativo={forma === "cadeira"}
          onClick={() => onEscolher("cadeira")}
        />
      )}
    </div>
  );
}

function Opcao({
  icone,
  titulo,
  apoio,
  valor,
  ativo,
  destaque = false,
  tom = "acao",
  onClick,
}: {
  icone: React.ReactNode;
  titulo: string;
  apoio: string;
  valor: string;
  ativo: boolean;
  destaque?: boolean;
  tom?: "acao" | "clube";
  onClick: () => void;
}) {
  const borda = ativo
    ? "border-acao bg-superficie-ativa"
    : destaque
      ? tom === "clube"
        ? "border-clube/50 bg-superficie-ativa hover:border-clube"
        : "border-borda-forte bg-superficie-ativa hover:border-acao"
      : "border-borda bg-superficie-ativa hover:border-borda-forte";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex items-start gap-3 rounded-card border px-4 py-3.5 text-left transition-colors ${borda}`}
    >
      <span
        className={`mt-0.5 shrink-0 ${
          ativo
            ? "text-acao"
            : tom === "clube" && destaque
              ? "text-clube"
              : "text-texto-suave"
        }`}
      >
        {icone}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-titulo text-base font-semibold">{titulo}</span>
        <span className="text-xs text-texto-suave">{apoio}</span>
      </span>
      <span
        className={`num shrink-0 font-titulo text-lg font-bold ${
          ativo ? "text-acao" : "text-texto"
        }`}
      >
        {valor}
      </span>
    </button>
  );
}

function CardClube({
  clube,
  reconhecido,
}: {
  clube: { ativo: boolean; precoCentavos: number; cortesMes: number };
  reconhecido: Reconhecido | null;
}) {
  if (!clube.ativo) return null;

  // Zero em cortesMes é o clube sem limite: aí não há barra de progresso,
  // porque não existe teto para preencher.
  const ilimitado = clube.cortesMes === 0 || Boolean(reconhecido?.ilimitado);
  const usados = reconhecido?.assinante
    ? clube.cortesMes - reconhecido.creditosRestantes
    : 0;
  const porcentagem = ilimitado
    ? 0
    : Math.round((usados / Math.max(1, clube.cortesMes)) * 100);

  return (
    <div className="flex flex-col gap-3 rounded-grande border border-borda bg-superficie p-4">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 shrink-0 text-clube" strokeWidth={2} />
        <span className="font-titulo text-sm font-semibold text-clube">
          Clube Johny
        </span>
      </div>

      {reconhecido?.assinante ? (
        <>
          {reconhecido.plano ? (
            <span className="font-titulo text-base font-semibold">
              {reconhecido.plano.nome}
            </span>
          ) : null}
          <div className="flex items-baseline gap-2">
            <span className="num font-titulo text-3xl font-bold text-texto">
              {ilimitado ? "Livre" : usados}
            </span>
            <span className="num text-sm text-texto-suave">
              {ilimitado
                ? `${reconhecido.cortesUsados} cortes neste mês`
                : `de ${clube.cortesMes} cortes usados`}
            </span>
          </div>
          {ilimitado ? null : (
            <div className="h-2 w-full overflow-hidden rounded-pill bg-superficie-apagada">
              <div
                className="h-full rounded-pill bg-clube transition-all"
                style={{ width: `${porcentagem}%` }}
              />
            </div>
          )}
          <p className="text-xs text-texto-suave">
            {reconhecido.plano
              ? `${reconhecido.plano.categorias.join(" e ")} sem limite, de segunda a quinta. Sexta e sábado sai no valor da tabela.`
              : ilimitado
                ? "Corte quantas vezes quiser. Enquanto a mensalidade estiver em dia, o corte sai sem pagar nada."
                : `Sobram ${reconhecido.creditosRestantes} cortes neste ciclo.`}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-end gap-1">
            <span className="num font-titulo text-3xl font-bold text-acao">
              {moedaCentavos(clube.precoCentavos)}
            </span>
            <span className="pb-1 text-sm text-texto-suave">/mês</span>
          </div>
          <p className="text-xs text-texto-suave">
            Planos de corte, barba ou os dois, sem limite de vezes, de segunda a
            quinta. Informe seu WhatsApp no passo 4 que eu reconheço sua
            assinatura.
          </p>
        </>
      )}
    </div>
  );
}

function Trilha({
  etapas,
  total,
}: {
  etapas: { rotulo: string; valor: string | null }[];
  total: number | null;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-grande border border-borda bg-superficie p-4">
      <span className="text-xs uppercase tracking-wide text-texto-apagado">
        Sua escolha
      </span>

      <ol className="flex flex-col">
        {etapas.map((etapa, i) => {
          const feito = Boolean(etapa.valor);
          const ultimo = i === etapas.length - 1;
          return (
            <li key={etapa.rotulo} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`num grid h-6 w-6 shrink-0 place-items-center rounded-pill border font-titulo text-xs font-bold ${
                    feito
                      ? "border-acao bg-acao text-acao-sobre"
                      : "border-borda text-texto-apagado"
                  }`}
                >
                  {i + 1}
                </span>
                {!ultimo ? (
                  <span className={`w-px flex-1 ${feito ? "bg-acao/50" : "bg-borda"}`} />
                ) : null}
              </div>
              <div className={`flex min-w-0 flex-col ${ultimo ? "" : "pb-4"}`}>
                <span className="text-xs text-texto-apagado">{etapa.rotulo}</span>
                <span
                  className={`truncate text-sm ${feito ? "text-texto" : "text-texto-apagado"}`}
                >
                  {etapa.valor ?? "a escolher"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-3 border-t border-borda pt-3">
        <span className="text-sm text-texto-suave">Total a pagar</span>
        <span
          className={`num font-titulo text-2xl font-bold ${
            total === null ? "text-texto-apagado" : "text-acao"
          }`}
        >
          {total === null ? "-" : moedaCentavos(total)}
        </span>
      </div>
    </div>
  );
}

function Status({
  fechado,
  servico,
  quando,
  nome,
  onRecomecar,
}: {
  fechado: Fechado;
  servico: Servico;
  quando: string;
  nome: string;
  onRecomecar: () => void;
}) {
  const aguardando = fechado.status === "pendente_pagamento";

  const linhas = [
    { rotulo: "Serviço", valor: `${servico.nome} · ${duracaoLabel(servico.duracaoMin)}` },
    { rotulo: "Quem corta", valor: fechado.barbeiro },
    { rotulo: "Quando", valor: quando },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-grande border border-borda-forte bg-superficie p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-pill border ${
            aguardando ? "border-alerta/50 text-alerta" : "border-acao/50 text-acao"
          }`}
        >
          {aguardando ? (
            <Timer className="h-5 w-5" strokeWidth={2} />
          ) : (
            <CalendarCheck className="h-5 w-5" strokeWidth={2} />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl">
            {aguardando ? "Reservado, aguardando o pix cair" : "Horário marcado"}
          </h2>
          <p className="text-sm text-texto-suave">
            {aguardando
              ? "A cadeira está no seu nome, mas só vira horário confirmado depois que o Johny der o ok no pagamento."
              : "Te esperamos na cadeira. Se precisar remarcar, use o link abaixo."}
          </p>
        </div>
      </div>

      <dl className="flex flex-col gap-2 rounded-card border border-borda bg-superficie-ativa p-4">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-sm text-texto-suave">{l.rotulo}</dt>
            <dd className="num truncate text-right text-sm font-medium text-texto">
              {l.valor}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 border-t border-borda pt-2">
          <dt className="text-sm text-texto-suave">Total</dt>
          <dd className="num font-titulo text-xl font-bold text-acao">
            {moedaCentavos(fechado.valorCentavos)}
          </dd>
        </div>
      </dl>

      {fechado.pix ? (
        <>
          <PainelPix
            brcode={fechado.pix.brcode}
            qrSvg={fechado.pix.qrSvg}
            chave={fechado.pix.chave}
            titular={fechado.pix.titular}
            valor={moedaCentavos(fechado.valorCentavos)}
            minutos={fechado.pix.minutos}
            seguraOHorario={aguardando}
          />
          <ComoConfirma
            minutos={fechado.pix.minutos}
            whatsapp={fechado.pix.whatsapp}
            mensagem={`Oi! Sou ${nome}, acabei de pagar o pix de ${moedaCentavos(fechado.valorCentavos)} do meu horário de ${quando}.`}
          />
        </>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/meu-agendamento/${fechado.token}`}
          className="inline-flex min-h-toque items-center justify-center rounded-pill bg-acao px-5 font-titulo text-sm font-bold text-acao-sobre transition-colors hover:bg-acao-hover"
        >
          Ver meu agendamento
        </Link>
        <button
          type="button"
          onClick={onRecomecar}
          className="inline-flex min-h-toque items-center justify-center rounded-pill border border-borda-forte px-5 font-titulo text-sm font-semibold text-texto transition-colors hover:border-acao"
        >
          Marcar outro
        </button>
      </div>
    </div>
  );
}
