"use server";

import { horariosLivres } from "@/lib/agenda/disponibilidade";
import { proximosDias, rotuloDe } from "@/lib/agenda/dias";
import {
  acharData,
  acharForma,
  acharHora,
  acharIntencao,
  acharNome,
  acharPorNome,
  acharTelefone,
  acharTurno,
  normalizar,
} from "@/lib/bot/interpretar";
import { barbeirosAtivos, casa, servicosAtivos } from "@/lib/dados/casa";
import { moedaCentavos, telefoneBonito } from "@/lib/formato";
import { reconhecerCliente, reservar } from "@/app/agendar/acoes";

/**
 * Bot de marcação: encadeamento de regras, sem modelo de linguagem.
 *
 * A cada mensagem ele roda TODOS os extratores e preenche tudo que conseguir,
 * depois pergunta só o primeiro campo que sobrou. É isso que faz "quero
 * degradê amanhã de tarde com o Diego" virar uma pergunta só, em vez de quatro.
 *
 * Toda decisão de horário e preço continua vindo das mesmas funções do site:
 * o bot é outra porta para a mesma casa, não uma segunda regra de negócio.
 */

export type Estado = {
  servicoId?: string;
  barbeiroId?: string | null;
  temBarbeiro?: boolean;
  data?: string;
  hora?: string;
  turno?: "manha" | "tarde";
  nome?: string;
  telefone?: string;
  forma?: "pix" | "cadeira" | "clube";
  assinante?: boolean;
  creditos?: number;
  token?: string;
};

export type Opcao = { rotulo: string; valor: string };

export type Resposta = {
  estado: Estado;
  falas: string[];
  opcoes: Opcao[];
  /** Frases de exemplo, para o cliente descobrir que pode escrever solto. */
  exemplos?: string[];
  /** Preenchido quando o agendamento fecha: a tela mostra o link. */
  token?: string;
  /**
   * O pix vai junto da resposta para o cliente pagar sem sair da conversa.
   * Mandar ele abrir outra tela na hora de pagar é onde se perde gente.
   */
  pix?: {
    brcode: string;
    qrSvg: string | null;
    chave: string;
    titular: string;
    valor: string;
    minutos: number;
    seguraOHorario: boolean;
  } | null;
};

/**
 * Exemplos montados com os dados reais da casa, serviço e barbeiro que
 * existem de verdade. Frase de exemplo genérica ensina menos, e frustra quando
 * o cliente copia e o bot não reconhece.
 */
async function exemplosDeUso() {
  const [servicos, barbeiros] = await Promise.all([
    servicosAtivos(),
    barbeirosAtivos(),
  ]);

  const principal = servicos[1]?.nome ?? servicos[0]?.nome ?? "corte";
  const rapido = servicos.find((s) => s.duracao_min <= 30)?.nome ?? principal;
  const quem = barbeiros[1]?.apelido ?? barbeiros[0]?.apelido ?? "";

  return [
    `${principal} amanhã de tarde${quem ? ` com o ${quem}` : ""}`,
    `tem horário hoje pra ${rapido.toLowerCase()}?`,
    "quanto custa a barba?",
    "sábado de manhã, tanto faz quem corta",
  ];
}

const hm = (h: string) => h;

export async function conversar(
  estadoAtual: Estado,
  mensagem: string,
): Promise<Resposta> {
  const texto = mensagem.trim();
  const estado: Estado = { ...estadoAtual };

  const [barbearia, servicos, barbeiros] = await Promise.all([
    casa(),
    servicosAtivos(),
    barbeirosAtivos(),
  ]);

  const dias = proximosDias(7);
  const falas: string[] = [];

  const listaServicos = servicos.map((s) => ({ id: s.id, nome: s.nome }));
  const listaBarbeiros = barbeiros.map((b) => ({ id: b.id, nome: b.apelido }));

  // ---- extração gulosa: tudo que der, de uma vez ----------------------------

  const intencao = acharIntencao(texto);

  if (!estado.servicoId) {
    const achado = acharPorNome(texto, listaServicos, {
      [listaServicos.find((s) => s.nome.includes("degradê"))?.id ?? ""]: [
        "degrade",
        "fade",
        "maquina",
      ],
      [listaServicos.find((s) => s.nome.includes("social"))?.id ?? ""]: [
        "social",
        "tesoura",
        "normal",
      ],
      [listaServicos.find((s) => s.nome.includes("Barba"))?.id ?? ""]: [
        "barba",
        "navalha",
      ],
    });
    if (achado) estado.servicoId = achado.id;
  }

  if (!estado.temBarbeiro) {
    if (/tanto faz|qualquer um|quem tiver|primeiro que/.test(normalizar(texto))) {
      estado.barbeiroId = null;
      estado.temBarbeiro = true;
    } else {
      const achado = acharPorNome(texto, listaBarbeiros);
      if (achado) {
        estado.barbeiroId = achado.id;
        estado.temBarbeiro = true;
      }
    }
  }

  if (!estado.data) {
    const achada = acharData(texto, dias);
    if (achada) estado.data = achada;
  }
  if (!estado.hora) {
    const achada = acharHora(texto);
    if (achada) estado.hora = achada;
  }
  if (!estado.turno) {
    const achado = acharTurno(texto);
    if (achado) estado.turno = achado;
  }
  if (!estado.telefone) {
    const achado = acharTelefone(texto);
    if (achado) estado.telefone = achado;
  }
  if (!estado.forma) {
    const achada = acharForma(texto);
    if (achada) estado.forma = achada;
  }
  if (!estado.nome && estado.telefone) {
    const achado = acharNome(texto);
    if (achado) estado.nome = achado;
  }

  const servico = servicos.find((s) => s.id === estado.servicoId) ?? null;

  // ---- perguntas que não são agendamento -----------------------------------

  if (intencao === "preco" && !servico) {
    falas.push(
      "A tabela é essa:\n" +
        servicos
          .map((s) => `• ${s.nome}, ${moedaCentavos(s.preco_centavos)} (${s.duracao_min} min)`)
          .join("\n"),
    );
    falas.push("Qual deles você quer marcar?");
    return {
      estado,
      falas,
      opcoes: servicos.slice(0, 4).map((s) => ({ rotulo: s.nome, valor: s.nome })),
    };
  }

  if (intencao === "endereco") {
    falas.push(
      `A gente fica na ${barbearia.endereco}. Qualquer coisa, ${telefoneBonito(barbearia.telefone ?? "")}.`,
    );
  }

  if (intencao === "horario") {
    falas.push(
      "Segunda a sexta das 08:30 às 18:30, sábado até 17:30, e o almoço para das 13h às 14h. Domingo a casa fecha.",
    );
  }

  if (intencao === "clube") {
    falas.push(
      `O Clube Johny é ${moedaCentavos(barbearia.clube_preco_centavos)} por mês com ${barbearia.clube_cortes_mes} cortes. Se você já assina, é só me passar seu WhatsApp que eu vejo seu saldo.`,
    );
  }

  if (intencao === "cancelar") {
    falas.push(
      "Para cancelar ou remarcar, use o link que te mandei quando marcou, ele abre a sua reserva. Se não achar, me chama que eu resolvo.",
    );
    return { estado, falas, opcoes: [] };
  }

  if (intencao === "saudacao" && !servico && !estado.data) {
    falas.push("Opa! Eu marco seu horário aqui mesmo, rapidinho.");
  }

  // ---- slot vazio manda na conversa ----------------------------------------

  if (!servico) {
    falas.push(
      falas.length ? "Qual serviço você quer?" : "Beleza. Qual serviço você quer?",
    );
    return {
      estado,
      falas,
      opcoes: servicos.slice(0, 5).map((s) => ({
        rotulo: `${s.nome} · ${moedaCentavos(s.preco_centavos)}`,
        valor: s.nome,
      })),
    };
  }

  if (!estado.temBarbeiro) {
    falas.push(`${servico.nome}, fechado. Com quem você quer cortar?`);
    return {
      estado,
      falas,
      opcoes: [
        { rotulo: "Tanto faz", valor: "tanto faz" },
        ...barbeiros.map((b) => ({ rotulo: b.apelido, valor: b.apelido })),
      ],
    };
  }

  if (!estado.data) {
    falas.push("Para que dia?");
    return {
      estado,
      falas,
      opcoes: dias
        .filter((d) => !d.fechado)
        .slice(0, 5)
        .map((d) => ({ rotulo: rotuloDe(d), valor: rotuloDe(d) })),
    };
  }

  // A partir daqui precisa da grade real.
  const livres = await horariosLivres({
    barbeariaId: barbearia.id,
    data: estado.data,
    duracaoMin: servico.duracao_min,
    barbeiroId: estado.barbeiroId ?? null,
  });

  const dia = dias.find((d) => d.data === estado.data);
  const quando = dia ? rotuloDe(dia) : estado.data;

  if (livres.length === 0) {
    estado.data = undefined;
    estado.hora = undefined;
    falas.push(
      `Poxa, ${quando} não tem mais nada livre para ${servico.nome}. Quer tentar outro dia?`,
    );
    return {
      estado,
      falas,
      opcoes: dias
        .filter((d) => !d.fechado && d.data !== dia?.data)
        .slice(0, 4)
        .map((d) => ({ rotulo: rotuloDe(d), valor: rotuloDe(d) })),
    };
  }

  const doTurno = estado.turno
    ? livres.filter((l) =>
        estado.turno === "manha"
          ? Number(l.hora.slice(0, 2)) < 13
          : Number(l.hora.slice(0, 2)) >= 13,
      )
    : livres;

  // Pediu um horário que não existe: mostra o mais perto em vez de só negar.
  if (estado.hora && !livres.some((l) => l.hora === estado.hora)) {
    const pedido = Number(estado.hora.slice(0, 2)) * 60 + Number(estado.hora.slice(3));
    const perto = [...livres].sort((a, b) => {
      const ma = Number(a.hora.slice(0, 2)) * 60 + Number(a.hora.slice(3));
      const mb = Number(b.hora.slice(0, 2)) * 60 + Number(b.hora.slice(3));
      return Math.abs(ma - pedido) - Math.abs(mb - pedido);
    }).slice(0, 4);

    falas.push(
      `${hm(estado.hora)} ${quando} já foi. O mais perto que tenho é ${perto[0].hora}.`,
    );
    estado.hora = undefined;
    return {
      estado,
      falas,
      opcoes: perto.map((l) => ({ rotulo: l.hora, valor: l.hora })),
    };
  }

  if (!estado.hora) {
    const mostrar = (doTurno.length ? doTurno : livres).slice(0, 6);
    falas.push(
      `${quando} eu tenho ${livres.length} horários. ${
        estado.turno ? "De " + (estado.turno === "manha" ? "manhã" : "tarde") + ":" : "Olha aí:"
      }`,
    );
    return {
      estado,
      falas,
      opcoes: mostrar.map((l) => ({ rotulo: l.hora, valor: l.hora })),
    };
  }

  if (!estado.telefone) {
    falas.push(
      `${quando} às ${estado.hora}, anotado. Me passa seu WhatsApp com DDD que eu já vejo se você é do clube.`,
    );
    return { estado, falas, opcoes: [] };
  }

  // Telefone na mão: descobre clube e nome de uma vez.
  if (estado.assinante === undefined) {
    const quem = await reconhecerCliente(estado.telefone);
    estado.assinante = quem.assinante;
    estado.creditos = quem.creditosRestantes;
    if (quem.nome && !estado.nome) estado.nome = quem.nome;

    if (quem.nome) {
      falas.push(
        quem.assinante
          ? `Achei você, ${quem.nome.split(" ")[0]}! Do clube, com ${quem.creditosRestantes} cortes sobrando neste ciclo.`
          : `Achei você, ${quem.nome.split(" ")[0]}.`,
      );
    }
  }

  if (!estado.nome) {
    falas.push("Como é seu nome?");
    return { estado, falas, opcoes: [] };
  }

  if (!estado.forma) {
    const podeClube =
      barbearia.clube_ativo &&
      servico.coberto_pelo_clube &&
      estado.assinante &&
      (estado.creditos ?? 0) > 0;

    const sobra = Math.max(0, servico.preco_centavos - servico.abate_centavos);

    falas.push(
      podeClube
        ? `Como prefere pagar? Dá para usar 1 corte do clube${sobra > 0 ? ` (aí sobram ${moedaCentavos(sobra)} na cadeira)` : " e não paga nada"}.`
        : `São ${moedaCentavos(servico.preco_centavos)}. Como prefere pagar?`,
    );

    return {
      estado,
      falas,
      opcoes: [
        ...(podeClube
          ? [{ rotulo: `Usar 1 corte do clube`, valor: "clube" }]
          : []),
        { rotulo: "Pix", valor: "pix" },
        { rotulo: "Dinheiro ou cartão na cadeira", valor: "dinheiro" },
      ],
    };
  }

  // ---- tudo preenchido: fecha ----------------------------------------------

  const saida = await reservar({
    data: estado.data,
    hora: estado.hora,
    servicoId: servico.id,
    barbeiroId: estado.barbeiroId ?? null,
    nome: estado.nome,
    telefone: estado.telefone,
    usarClube: estado.forma === "clube",
    formaPagamento: estado.forma,
  });

  if (!saida.ok) {
    estado.hora = undefined;
    falas.push(`${saida.erro} Vamos escolher outro horário?`);
    const novos = await horariosLivres({
      barbeariaId: barbearia.id,
      data: estado.data,
      duracaoMin: servico.duracao_min,
      barbeiroId: estado.barbeiroId ?? null,
    });
    return {
      estado,
      falas,
      opcoes: novos.slice(0, 5).map((l) => ({ rotulo: l.hora, valor: l.hora })),
    };
  }

  const barbeiroFinal =
    saida.barbeiro ||
    barbeiros.find((b) => b.id === estado.barbeiroId)?.apelido ||
    "";

  const aguardando = saida.status === "pendente_pagamento";

  falas.push(
    aguardando
      ? `Reservei ${quando} às ${estado.hora} com ${barbeiroFinal}. Falta o pix cair para confirmar.`
      : `Pronto! ${servico.nome} ${quando} às ${estado.hora} com ${barbeiroFinal}.`,
  );

  if (saida.pix) {
    falas.push(
      aguardando
        ? `São ${moedaCentavos(saida.valorCentavos)}. Aponta a câmera do banco no QR ou copia o código, o horário fica seguro por ${barbearia.reserva_minutos} minutos.`
        : `São ${moedaCentavos(saida.valorCentavos)}. Se quiser adiantar, é só pagar aqui mesmo.`,
    );
  } else if (estado.forma === "clube") {
    falas.push("Usei 1 corte do seu clube. Não precisa pagar nada agora.");
  } else {
    falas.push(
      `São ${moedaCentavos(saida.valorCentavos)}, você acerta com o barbeiro na cadeira.`,
    );
  }

  return {
    estado: { ...estado, token: saida.token },
    falas,
    opcoes: [],
    token: saida.token,
    pix: saida.pix
      ? {
          brcode: saida.pix.brcode,
          qrSvg: saida.pix.qrSvg,
          chave: saida.pix.chave,
          titular: saida.pix.titular,
          valor: moedaCentavos(saida.valorCentavos),
          minutos: saida.pix.minutos,
          seguraOHorario: aguardando,
        }
      : null,
  };
}

/** Primeira fala, antes de o cliente escrever qualquer coisa. */
export async function abertura(): Promise<Resposta> {
  const [barbearia, servicos, exemplos] = await Promise.all([
    casa(),
    servicosAtivos(),
    exemplosDeUso(),
  ]);

  return {
    estado: {},
    falas: [
      `Fala! Aqui é a ${barbearia.nome}.`,
      "Me diz o que você quer que eu marco na hora. Pode escrever do seu jeito, quanto mais coisa na mesma frase, menos eu pergunto.",
    ],
    opcoes: servicos.slice(0, 4).map((s) => ({
      rotulo: `${s.nome} · ${moedaCentavos(s.preco_centavos)}`,
      valor: s.nome,
    })),
    exemplos,
  };
}

/** A tela pede de novo quando o cliente abre o "como pedir". */
export async function dicas() {
  return exemplosDeUso();
}

