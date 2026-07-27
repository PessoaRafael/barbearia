import {
  ASSINANTES,
  CAIXA_HOJE,
  CLIENTES,
  CLUBE,
  MENSALIDADES_VENCIDAS,
  METRICAS,
  SERVICOS_MES,
} from "@/painel";
import { SERVICOS } from "@/servicos";
import { moeda, numero } from "./formato";

export type Indicador = { rotulo: string; valor: string };

export type LinhaLista = {
  id: string;
  nome: string;
  contexto: string;
  metrica: string;
  valor: string;
  acao: string;
  tom?: "neutro" | "alerta";
  ponto?: boolean;
  tags: string[];
};

export type LateralLista = {
  numero: { valor: string; rotulo: string };
  metricas: { rotulo: string; valor: string }[];
  acao: { titulo: string; texto: string; botao: string; tom?: "acao" | "alerta" };
};

export type AbaLista = {
  id: "clube" | "clientes" | "servicos" | "caixa";
  titulo: string;
  descricao: string;
  indicadores: Indicador[];
  filtros: string[];
  linhas: LinhaLista[];
  lateral: LateralLista;
  vazio: { titulo: string; texto: string };
};

export const INDICADORES_AGENDA: Indicador[] = [
  { rotulo: "Marcados hoje", valor: numero(METRICAS.hoje.marcados) },
  { rotulo: "Cadeiras vazias", valor: numero(METRICAS.hoje.cadeirasVazias) },
  { rotulo: "A receber hoje", valor: moeda(METRICAS.hoje.aReceber) },
];

const categoriaDoServico = (nome: string) =>
  SERVICOS.find((s) => s.nome === nome)?.categoria ?? "Cortes";

export const ABAS: Record<AbaLista["id"], AbaLista> = {
  clube: {
    id: "clube",
    titulo: "Clube Johny",
    descricao: "Quem assina, quanto entra e quem está devendo.",
    indicadores: [
      { rotulo: "Assinantes", valor: numero(CLUBE.assinantes) },
      { rotulo: "Receita do clube", valor: moeda(METRICAS.mes.clube) },
      { rotulo: "Mensalidades vencidas", valor: numero(MENSALIDADES_VENCIDAS.length) },
    ],
    filtros: ["Todos", "Em dia", "Vencidos", "Cortes no fim"],
    linhas: ASSINANTES.map((a) => ({
      id: a.nome,
      nome: a.nome,
      contexto: a.desde,
      metrica: a.usados,
      valor: `${moeda(a.valor)}/mês`,
      acao: a.vencido ? "Cobrar" : "Histórico",
      tom: a.vencido ? ("alerta" as const) : ("neutro" as const),
      ponto: true,
      tags: [
        a.vencido ? "Vencidos" : "Em dia",
        ...(a.usados.startsWith("4") ? ["Cortes no fim"] : []),
      ],
    })),
    lateral: {
      numero: { valor: numero(CLUBE.assinantes), rotulo: "assinantes ativos" },
      metricas: [
        { rotulo: "Entra por mês", valor: moeda(METRICAS.mes.clube) },
        { rotulo: "Cortes usados no mês", valor: numero(METRICAS.base.cortesNoMes) },
        { rotulo: "Novos assinantes", valor: numero(METRICAS.mes.novos) },
      ],
      acao: {
        titulo: `${MENSALIDADES_VENCIDAS.length} mensalidades vencidas`,
        texto: "Manda a cobrança de uma vez para quem está atrasado.",
        botao: "Cobrar todos",
        tom: "alerta",
      },
    },
    vazio: {
      titulo: "Nenhum assinante nesse filtro",
      texto: "Troque o filtro acima para ver o resto do clube.",
    },
  },

  clientes: {
    id: "clientes",
    titulo: "Clientes",
    descricao: "Histórico, frequência e quem parou de aparecer.",
    indicadores: [
      { rotulo: "Na base", valor: numero(METRICAS.base.clientes) },
      { rotulo: "Novos no mês", valor: numero(METRICAS.mes.novos) },
      { rotulo: "Sumidos", valor: numero(METRICAS.mes.sumidos) },
    ],
    filtros: ["Todos", "Assinantes", "Sumidos", "Faltosos"],
    linhas: CLIENTES.map((c) => ({
      id: c.nome,
      nome: c.nome,
      contexto: c.ultimo,
      metrica: c.frequencia,
      valor: c.gasto > 0 ? moeda(c.gasto) : "—",
      acao: c.sumido ? "Chamar" : "Histórico",
      tom: c.sumido || c.faltoso ? ("alerta" as const) : ("neutro" as const),
      ponto: c.assinante,
      tags: [
        ...(c.assinante ? ["Assinantes"] : []),
        ...(c.sumido ? ["Sumidos"] : []),
        ...(c.faltoso ? ["Faltosos"] : []),
      ],
    })),
    lateral: {
      numero: { valor: numero(METRICAS.base.clientes), rotulo: "clientes na base" },
      metricas: [
        { rotulo: "Ticket médio", valor: moeda(METRICAS.mes.ticketMedio) },
        { rotulo: "Ocupação do mês", valor: METRICAS.mes.ocupacao },
        { rotulo: "Faltas no mês", valor: numero(METRICAS.mes.faltas) },
      ],
      acao: {
        titulo: `${METRICAS.mes.sumidos} sumidos há 30 dias`,
        texto: "Uma mensagem curta costuma trazer metade deles de volta.",
        botao: "Mandar mensagem",
      },
    },
    vazio: {
      titulo: "Nenhum cliente nesse filtro",
      texto: "Troque o filtro acima para ver o resto da base.",
    },
  },

  servicos: {
    id: "servicos",
    titulo: "Serviços",
    descricao: "Preço, duração e o que mais sai no mês.",
    indicadores: [
      { rotulo: "Serviços ativos", valor: numero(SERVICOS.length) },
      { rotulo: "Cortes no mês", valor: numero(METRICAS.base.cortesNoMes) },
      { rotulo: "Ticket médio", valor: moeda(METRICAS.mes.ticketMedio) },
    ],
    filtros: ["Todos", "Cortes", "Barba", "Acabamento", "Química"],
    linhas: SERVICOS_MES.map((s) => ({
      id: s.nome,
      nome: s.nome,
      contexto: s.duracao,
      metrica: `${numero(s.quantidade)} no mês`,
      valor: moeda(s.receita),
      acao: "Editar",
      tags: [categoriaDoServico(s.nome)],
    })),
    lateral: {
      numero: { valor: numero(SERVICOS.length), rotulo: "serviços na régua" },
      metricas: [
        { rotulo: "Mais pedido", valor: "Corte degradê" },
        { rotulo: "Receita do mês", valor: moeda(METRICAS.mes.faturamento) },
        { rotulo: "Tempo médio", valor: "38 min" },
      ],
      acao: {
        titulo: "Faltando algo na régua?",
        texto: "Serviço novo entra na hora na tela de agendamento.",
        botao: "Novo serviço",
      },
    },
    vazio: {
      titulo: "Nenhum serviço nessa categoria",
      texto: "Troque o filtro acima ou cadastre um serviço novo.",
    },
  },

  caixa: {
    id: "caixa",
    titulo: "Caixa",
    descricao: "O que entrou hoje e o que ainda está para entrar.",
    indicadores: [
      { rotulo: "Já entrou", valor: moeda(METRICAS.hoje.jaEntrou) },
      { rotulo: "A receber hoje", valor: moeda(METRICAS.hoje.aReceber) },
      { rotulo: "Faturamento do mês", valor: moeda(METRICAS.mes.faturamento) },
    ],
    filtros: ["Tudo", "Pix", "Cartão", "Dinheiro", "Clube"],
    linhas: CAIXA_HOJE.map((c, i) => ({
      id: `${c.cliente}-${i}`,
      nome: c.cliente,
      contexto: c.detalhe,
      metrica: c.forma,
      valor: moeda(c.valor),
      acao: "Recibo",
      tags: [c.forma === "cartão" ? "Cartão" : c.forma === "pix" ? "Pix" : c.forma === "clube" ? "Clube" : "Dinheiro"],
    })),
    lateral: {
      numero: { valor: moeda(METRICAS.hoje.aReceber), rotulo: "previsto para hoje" },
      metricas: [
        { rotulo: "Já entrou", valor: moeda(METRICAS.hoje.jaEntrou) },
        { rotulo: "Clube no mês", valor: moeda(METRICAS.mes.clube) },
        { rotulo: "Avulso no mês", valor: moeda(METRICAS.mes.avulso) },
      ],
      acao: {
        titulo: "Fechar o caixa do dia",
        texto: "Confere as entradas e trava o dia às 19h.",
        botao: "Fechar caixa",
      },
    },
    vazio: {
      titulo: "Nenhuma entrada nesse filtro",
      texto: "Troque a forma de pagamento no filtro acima.",
    },
  },
};

export function filtrar(aba: AbaLista, filtro: string) {
  if (filtro === aba.filtros[0]) return aba.linhas;
  return aba.linhas.filter((linha) => linha.tags.includes(filtro));
}
