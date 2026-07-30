/**
 * Testa o interpretador do bot: frase solta entra, campos preenchidos saem.
 * Roda com: npm run teste:bot
 */

import {
  acharData,
  acharForma,
  acharHora,
  acharIntencao,
  acharNome,
  acharPorNome,
  acharTelefone,
  acharTurno,
} from "../lib/bot/interpretar.ts";

let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome}`);
  if (!ok) console.log(`        esperado ${esperado}, obtido ${obtido}`);
};

const SERVICOS = [
  { id: "social", nome: "Corte social" },
  { id: "degrade", nome: "Corte degradê" },
  { id: "barba", nome: "Barba na navalha" },
  { id: "platinado", nome: "Platinado" },
];
const BARBEIROS = [
  { id: "johny", nome: "Johny" },
  { id: "anderson", nome: "Anderson" },
  { id: "davi", nome: "Davi" },
];

// Régua fixa começando numa segunda, para o teste não depender de hoje.
const DIAS = [
  { data: "2026-08-03", numero: "03", mes: "ago", fechado: false },
  { data: "2026-08-04", numero: "04", mes: "ago", fechado: false },
  { data: "2026-08-05", numero: "05", mes: "ago", fechado: false },
  { data: "2026-08-06", numero: "06", mes: "ago", fechado: false },
  { data: "2026-08-07", numero: "07", mes: "ago", fechado: false },
  { data: "2026-08-08", numero: "08", mes: "ago", fechado: false },
  { data: "2026-08-09", numero: "09", mes: "ago", fechado: true },
];

console.log("\n1. Serviço pelo jeito que o cliente fala");
conferir("degradê", acharPorNome("quero um corte degradê", SERVICOS)?.id, "degrade");
conferir("sem acento", acharPorNome("corte degrade por favor", SERVICOS)?.id, "degrade");
conferir("errando a digitação", acharPorNome("queria um degrado", SERVICOS)?.id, "degrade");
conferir("barba", acharPorNome("fazer a barba", SERVICOS)?.id, "barba");
conferir("não inventa serviço", acharPorNome("bom dia", SERVICOS)?.id, undefined);

console.log("\n2. Barbeiro");
conferir("nome no meio da frase", acharPorNome("pode ser com o anderson", BARBEIROS)?.id, "anderson");
conferir("caixa alta", acharPorNome("DAVI", BARBEIROS)?.id, "davi");

console.log("\n3. Dia");
conferir("hoje", acharData("quero hoje", DIAS), "2026-08-03");
conferir("amanhã", acharData("pode ser amanha", DIAS), "2026-08-04");
conferir("dia da semana", acharData("marca pra quinta", DIAS), "2026-08-06");
conferir("dia do mês", acharData("dia 7", DIAS), "2026-08-07");
conferir("data com barra", acharData("05/08", DIAS), "2026-08-05");

console.log("\n4. Hora");
conferir("15h", acharHora("pode ser 15h"), "15:00");
conferir("com minuto", acharHora("as 14:30"), "14:30");
conferir("3 da tarde", acharHora("3 da tarde"), "15:00");
conferir("9 da manhã", acharHora("9 da manha"), "09:00");
conferir("meio dia", acharHora("meio dia"), "12:00");

console.log("\n5. Turno, telefone e pagamento");
conferir("de tarde", acharTurno("qualquer hora de tarde"), "tarde");
conferir("cedo", acharTurno("prefiro cedo"), "manha");
conferir("telefone com máscara", acharTelefone("(84) 99983-5180"), "84999835180");
conferir("telefone com 55", acharTelefone("5584999835180"), "84999835180");
conferir("pix", acharForma("vou de pix"), "pix");
conferir("na cadeira", acharForma("pago dinheiro na hora"), "cadeira");
conferir("clube", acharForma("usa meu credito do clube"), "clube");

console.log("\n6. Perguntas que não são agendamento");
conferir("preço", acharIntencao("quanto custa o corte"), "preco");
conferir("endereço", acharIntencao("onde fica voces"), "endereco");
conferir("cancelar", acharIntencao("preciso desmarcar"), "cancelar");
conferir("saudação", acharIntencao("bom dia"), "saudacao");

console.log("\n7. Bugs que já morderam antes");

// O botão de dia mandava o rótulo de volta e o bot repetia a pergunta.
conferir("data crua do botão", acharData("2026-08-06", DIAS), "2026-08-06");
conferir("abreviação do dia", acharData("qua 05/ago", DIAS), "2026-08-05");

// "cartão de crédito" tem a palavra crédito e virava crédito do clube.
conferir("cartão de crédito não é clube", acharForma("vou de cartão de crédito"), "cadeira");
conferir("clube continua sendo clube", acharForma("usa meu credito do clube"), "clube");

// Nome era recusado por conter pedaço de palavra do ruído.
conferir("Sérgio é nome", acharNome("Sérgio"), "Sérgio");
conferir("Simone é nome", acharNome("Simone"), "Simone");
conferir("Nao é nome, é recusa", acharNome("não"), undefined);
conferir("frase de agendamento não é nome", acharNome("quero marcar"), undefined);

conferir("recomeçar é reconhecido", acharIntencao("quero recomeçar"), "recomecar");
conferir("negativa é reconhecida", acharIntencao("não, obrigado"), "negar");

console.log("\n8. A frase que faz parecer IA");
const frase = "quero corte degradê amanhã de tarde com o anderson";
conferir("serviço", acharPorNome(frase, SERVICOS)?.id, "degrade");
conferir("barbeiro", acharPorNome(frase, BARBEIROS)?.id, "anderson");
conferir("dia", acharData(frase, DIAS), "2026-08-04");
conferir("turno", acharTurno(frase), "tarde");

console.log("");
if (falhas) {
  console.error(`${falhas} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("Interpretador ok.");
