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
  type Pix,
  type Reconhecido,
} from "@/app/agendar/acoes";
import { rotuloDe, type Dia } from "@/lib/agenda/dias";
import { moedaCentavos, telefoneBonito } from "@/lib/formato";
import { ComoConfirma } from "./ComoConfirma";
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

  const podeClube =
    clube.ativo &&
    Boolean(servico?.cobertoPeloClube) &&
    Boolean(reconhecido?.assinante) &&
    (reconhecido?.creditosRestantes ?? 0) > 0;

  const valorCentavos = !servico
    ? 0
    : forma === "clube"
      ? comClube(servico)
      : servico.precoCentavos;

  const faltam = [
    servicoId,
    temBarbeiro ? "ok" : null,
    hora,
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

  function limparDepoisDe(passo: number) {
    if (passo <= 1) {
      setBarbeiro(null);
      setTemBarbeiro(false);
    }
    if (passo <= 2) setHora(null);
    if (passo <= 4) setForma(null);
    setErro(null);
  }

  function escolherServico(id: string) {
    if (id !== servicoId) {
      limparDepoisDe(1);
      setHorarios(null);
    }
    setServicoId(id);
    setPassoAberto(2);
  }

  function escolherBarbeiro(valor: Escolha) {
    setBarbeiro(valor);
    setTemBarbeiro(true);
    setHora(null);
    setForma(null);
    setPassoAberto(3);
  }

  function escolherHora(valor: string) {
    setHora(valor);
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
        setPassoAberto(3);
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
    temBarbeiro,
    Boolean(hora),
    Boolean(reconhecido !== null && nome.trim()),
    Boolean(forma),
  ];
  const travado = [
    false,
    !servico,
    !temBarbeiro,
    !hora,
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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 pb-32 pt-6 sm:px-8 lg:px-10 lg:pb-14">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">Agendar horário</h1>
          <p className="text-texto-suave">
            Um passo de cada vez. Dá para voltar em qualquer um.
          </p>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-[76px] lg:order-2 lg:w-[300px] lg:shrink-0 xl:w-[340px]">
            <CardClube clube={clube} reconhecido={reconhecido} />
            <div className="hidden lg:block">
              <Trilha
                etapas={[
                  {
                    rotulo: "Serviço",
                    valor: servico
                      ? `${servico.nome} · ${duracaoLabel(servico.duracaoMin)}`
                      : null,
                  },
                  { rotulo: "Quem corta", valor: temBarbeiro ? nomeBarbeiro : null },
                  { rotulo: "Quando", valor: hora ? quando : null },
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

                <Passo
                  numero={2}
                  titulo="Quem corta"
                  estado={estado(2)}
                  motivo="liberado depois do serviço"
                  resumo={nomeBarbeiro}
                  onAbrir={() => setPassoAberto(2)}
                >
                  <PassoBarbeiro
                    barbeiros={barbeiros}
                    escolha={barbeiro}
                    temEscolha={temBarbeiro}
                    dia={dia}
                    horarios={horarios}
                    carregando={carregando}
                    onEscolher={escolherBarbeiro}
                  />
                </Passo>

                <Passo
                  numero={3}
                  titulo="Quando"
                  estado={estado(3)}
                  motivo="liberado depois do barbeiro"
                  resumo={quando}
                  onAbrir={() => setPassoAberto(3)}
                >
                  <PassoHorario
                    dias={dias}
                    dia={dia}
                    horarios={horarios}
                    carregando={carregando}
                    escolha={barbeiro}
                    hora={hora}
                    servicoId={servicoId}
                    onDia={(d) => {
                      setData(d);
                      setHora(null);
                      setHorarios(null);
                    }}
                    onHora={escolherHora}
                  />
                </Passo>

                <Passo
                  numero={4}
                  titulo="Seus dados"
                  estado={estado(4)}
                  motivo="liberado depois do horário"
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
  reconhecido,
  obrigatorio,
  forma,
  onEscolher,
}: {
  servico: Servico;
  podeClube: boolean;
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
          titulo="Usar 1 corte do clube"
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

      {servico.cobertoPeloClube && !podeClube && reconhecido?.vencida ? (
        <p className="rounded-card border border-alerta/50 bg-superficie-ativa px-4 py-3 text-xs text-alerta">
          Sua mensalidade está vencida, então o corte sai avulso. Fale com o
          Johny para voltar a usar os créditos.
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
            {ilimitado
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
            {clube.cortesMes === 0
              ? "Corte quantas vezes quiser. Informe seu WhatsApp no passo 4 que eu reconheço sua assinatura."
              : `${clube.cortesMes} cortes por mês. Informe seu WhatsApp no passo 4 que eu reconheço sua assinatura.`}
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
