import type { BarbeiroId } from "./agenda";

export const CLIENTE_LOGADO = {
  nome: "Wesley",
  nomeCompleto: "Wesley Costa",
  assinante: true,
  cortesUsados: 2,
  cortesTotais: 4,
  renovaEm: "3 de agosto",
};

export const CLUBE = {
  nome: "Clube Johny",
  mensalidade: 99,
  /** Zero é ilimitado: o assinante corta quantas vezes quiser. */
  cortesPorMes: 0,
  assinantes: 62,
  beneficios: [
    "Corte quantas vezes quiser, sem limite no mês",
    "Escolhe o horário e o barbeiro, como qualquer cliente",
    "Cancela quando quiser, sem multa",
  ],
};

export const PIX = {
  chave: "pagamentos@johnybarbearia.com.br",
  reservaMinutos: 15,
};

export type Agendamento = {
  barbeiro: BarbeiroId;
  hora: string;
  duracaoMin: number;
  cliente: string;
  servico: string;
  assinante: boolean;
};

export const AGENDA_HOJE: Agendamento[] = [
  { barbeiro: "johny", hora: "09:00", duracaoMin: 40, cliente: "Wesley Costa", servico: "Corte degradê", assinante: true },
  { barbeiro: "johny", hora: "10:00", duracaoMin: 60, cliente: "Rafael Bento", servico: "Corte + barba", assinante: false },
  { barbeiro: "johny", hora: "11:30", duracaoMin: 30, cliente: "Marcos Aurélio", servico: "Barba na navalha", assinante: true },
  { barbeiro: "johny", hora: "14:00", duracaoMin: 40, cliente: "Igor Vasconcelos", servico: "Corte degradê", assinante: true },
  { barbeiro: "johny", hora: "15:30", duracaoMin: 30, cliente: "Hélio Torres", servico: "Corte social", assinante: false },
  { barbeiro: "johny", hora: "17:00", duracaoMin: 60, cliente: "Tiago Meireles", servico: "Corte + barba", assinante: true },
  { barbeiro: "diego", hora: "09:30", duracaoMin: 40, cliente: "Bruno Sales", servico: "Corte degradê", assinante: false },
  { barbeiro: "diego", hora: "10:30", duracaoMin: 15, cliente: "Alan Praxedes", servico: "Pezinho", assinante: true },
  { barbeiro: "diego", hora: "11:00", duracaoMin: 40, cliente: "Éverton Lima", servico: "Corte degradê", assinante: true },
  { barbeiro: "diego", hora: "14:30", duracaoMin: 120, cliente: "Jonas Pinheiro", servico: "Platinado", assinante: false },
  { barbeiro: "diego", hora: "17:00", duracaoMin: 40, cliente: "Wesley Costa", servico: "Corte degradê", assinante: true },
  { barbeiro: "diego", hora: "18:00", duracaoMin: 30, cliente: "Rafael Bento", servico: "Corte social", assinante: false },
  { barbeiro: "kaio", hora: "09:00", duracaoMin: 30, cliente: "Marcos Aurélio", servico: "Corte social", assinante: true },
  { barbeiro: "kaio", hora: "12:00", duracaoMin: 10, cliente: "Igor Vasconcelos", servico: "Sobrancelha", assinante: true },
  { barbeiro: "kaio", hora: "14:00", duracaoMin: 120, cliente: "Tiago Meireles", servico: "Platinado", assinante: false },
  { barbeiro: "kaio", hora: "16:30", duracaoMin: 40, cliente: "Hélio Torres", servico: "Corte degradê", assinante: false },
  { barbeiro: "kaio", hora: "18:00", duracaoMin: 30, cliente: "Bruno Sales", servico: "Barba na navalha", assinante: true },
];

export const AGENDA_AMANHA: Agendamento[] = [
  { barbeiro: "johny", hora: "09:00", duracaoMin: 30, cliente: "Hélio Torres", servico: "Corte social", assinante: false },
  { barbeiro: "johny", hora: "11:30", duracaoMin: 30, cliente: "Bruno Sales", servico: "Barba na navalha", assinante: true },
  { barbeiro: "johny", hora: "15:00", duracaoMin: 60, cliente: "Wesley Costa", servico: "Corte + barba", assinante: true },
  { barbeiro: "johny", hora: "18:00", duracaoMin: 30, cliente: "Sérgio Bezerra", servico: "Corte social", assinante: false },
  { barbeiro: "diego", hora: "10:00", duracaoMin: 40, cliente: "Éverton Lima", servico: "Corte degradê", assinante: true },
  { barbeiro: "diego", hora: "14:00", duracaoMin: 30, cliente: "Jonas Pinheiro", servico: "Corte social", assinante: false },
  { barbeiro: "diego", hora: "16:30", duracaoMin: 15, cliente: "Alan Praxedes", servico: "Pezinho", assinante: true },
  { barbeiro: "kaio", hora: "09:30", duracaoMin: 30, cliente: "Rafael Bento", servico: "Corte social", assinante: false },
  { barbeiro: "kaio", hora: "11:00", duracaoMin: 10, cliente: "Igor Vasconcelos", servico: "Sobrancelha", assinante: true },
  { barbeiro: "kaio", hora: "14:30", duracaoMin: 30, cliente: "Marcos Aurélio", servico: "Barba na navalha", assinante: true },
  { barbeiro: "kaio", hora: "17:00", duracaoMin: 30, cliente: "Tiago Meireles", servico: "Corte social", assinante: true },
];

/** Régua de dias do painel: só hoje e amanhã têm movimento; domingo é fechado. */
export const AGENDA_POR_DIA: Record<string, Agendamento[]> = {
  d0: AGENDA_HOJE,
  d1: AGENDA_AMANHA,
  d6: [],
};

export const PIX_PENDENTES = [
  { cliente: "Bruno Sales", reserva: "sáb 01/ago 10:00", expiraEm: "11 min", valor: 40 },
  { cliente: "Hélio Torres", reserva: "hoje 15:30", expiraEm: "4 min", valor: 50 },
];

export const MENSALIDADES_VENCIDAS = [
  { cliente: "Rafael Bento", atraso: "vencida há 12 dias", valor: 99 },
  { cliente: "Marcos Aurélio", atraso: "vencida há 8 dias", valor: 99 },
  { cliente: "Igor Vasconcelos", atraso: "vencida há 5 dias", valor: 99 },
  { cliente: "Éverton Lima", atraso: "vencida há 3 dias", valor: 99 },
];

export const ASSINANTES = [
  { nome: "Wesley Costa", desde: "assinante desde março", usados: "2 de 4 cortes no mês", vencido: false, valor: 99 },
  { nome: "Rafael Bento", desde: "assinante desde janeiro", usados: "4 de 4 cortes no mês", vencido: true, valor: 99 },
  { nome: "Marcos Aurélio", desde: "assinante desde maio", usados: "1 de 4 cortes no mês", vencido: true, valor: 99 },
  { nome: "Igor Vasconcelos", desde: "assinante desde fevereiro", usados: "3 de 4 cortes no mês", vencido: true, valor: 99 },
  { nome: "Éverton Lima", desde: "assinante desde junho", usados: "2 de 4 cortes no mês", vencido: true, valor: 99 },
  { nome: "Tiago Meireles", desde: "assinante desde abril", usados: "3 de 4 cortes no mês", vencido: false, valor: 99 },
  { nome: "Alan Praxedes", desde: "assinante desde março", usados: "4 de 4 cortes no mês", vencido: false, valor: 99 },
  { nome: "Bruno Sales", desde: "assinante desde julho", usados: "1 de 4 cortes no mês", vencido: false, valor: 99 },
];

export const CLIENTES = [
  { nome: "Wesley Costa", ultimo: "último corte hoje", frequencia: "9 cortes em 90 dias", gasto: 99, assinante: true },
  { nome: "Hélio Torres", ultimo: "último corte há 6 dias", frequencia: "5 cortes em 90 dias", gasto: 75, assinante: false },
  { nome: "Jonas Pinheiro", ultimo: "último corte há 11 dias", frequencia: "3 cortes em 90 dias", gasto: 150, assinante: false },
  { nome: "Tiago Meireles", ultimo: "último corte hoje", frequencia: "11 cortes em 90 dias", gasto: 99, assinante: true },
  { nome: "Diego Moura", ultimo: "último corte há 38 dias", frequencia: "2 cortes em 90 dias", gasto: 0, assinante: false, sumido: true },
  { nome: "Paulo Renan", ultimo: "último corte há 44 dias", frequencia: "1 corte em 90 dias", gasto: 0, assinante: false, sumido: true },
  { nome: "Alan Praxedes", ultimo: "último corte hoje", frequencia: "8 cortes em 90 dias", gasto: 99, assinante: true },
  { nome: "Sérgio Bezerra", ultimo: "faltou duas vezes em julho", frequencia: "4 cortes em 90 dias", gasto: 40, assinante: false, faltoso: true },
];

export const SERVICOS_MES = [
  { nome: "Corte degradê", duracao: "40 min", quantidade: 96, receita: 3840 },
  { nome: "Corte social", duracao: "30 min", quantidade: 61, receita: 2135 },
  { nome: "Corte + barba", duracao: "1 hora", quantidade: 28, receita: 1680 },
  { nome: "Barba na navalha", duracao: "30 min", quantidade: 24, receita: 720 },
  { nome: "Platinado", duracao: "2 horas", quantidade: 4, receita: 600 },
  { nome: "Pezinho", duracao: "15 min", quantidade: 31, receita: 465 },
  { nome: "Sobrancelha", duracao: "10 min", quantidade: 19, receita: 228 },
];

export const CAIXA_HOJE = [
  { cliente: "Wesley Costa", detalhe: "09:00 · Corte degradê", forma: "clube", valor: 0 },
  { cliente: "Bruno Sales", detalhe: "09:30 · Corte degradê", forma: "pix", valor: 40 },
  { cliente: "Marcos Aurélio", detalhe: "09:00 · Corte social", forma: "clube", valor: 0 },
  { cliente: "Rafael Bento", detalhe: "10:00 · Corte + barba", forma: "cartão", valor: 60 },
  { cliente: "Alan Praxedes", detalhe: "10:30 · Pezinho", forma: "dinheiro", valor: 15 },
  { cliente: "Éverton Lima", detalhe: "11:00 · Corte degradê", forma: "clube", valor: 0 },
  { cliente: "Jonas Pinheiro", detalhe: "14:30 · Platinado", forma: "pix", valor: 150 },
  { cliente: "Hélio Torres", detalhe: "15:30 · Corte social", forma: "dinheiro", valor: 35 },
];

export const METRICAS = {
  hoje: { marcados: 17, cadeirasVazias: 13, aReceber: 615, jaEntrou: 300 },
  mes: { faturamento: 8470, clube: 6138, avulso: 2332, ocupacao: "78%", faltas: 7, sumidos: 11, novos: 23, ticketMedio: 41 },
  base: { clientes: 318, assinantes: 62, servicos: 7, cortesNoMes: 263 },
};

export const NAV_PAINEL = [
  { id: "agenda", nome: "Agenda", sub: "hoje e próximos dias", badge: "17" },
  { id: "clube", nome: "Clube", sub: "assinantes e cobrança", badge: "62" },
  { id: "clientes", nome: "Clientes", sub: "histórico e sumidos", badge: "318" },
  { id: "servicos", nome: "Serviços", sub: "preço e duração", badge: "7" },
  { id: "caixa", nome: "Caixa", sub: "entradas do dia", badge: "R$ 615" },
];
