/**
 * Aplica a tabela de preços que o Johny mandou.
 *
 * O preço veio dele. A DURAÇÃO e a COBERTURA DO CLUBE são estimativa minha,
 * porque não vieram na tabela, e as duas mexem no sistema inteiro: a duração
 * decide quantos horários cabem no dia, e o abate decide quanto o clube
 * custa para a casa. Confira as duas colunas com ele e ajuste na aba
 * Serviços, que edita tudo pela tela.
 *
 * Uso: node scripts/aplicar-precos.mjs --apagar-antigos
 */

import { readFileSync } from "node:fs";

for (const linha of readFileSync(".env.local", "utf8").split("\n")) {
  const par = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (par) process.env[par[1]] = par[2].trim().replace(/^["']|["']$/g, "");
}

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

/**
 * O clube é R$ 99 por 4 cortes, ou seja, R$ 24,75 por corte. Cobrir corte de
 * R$ 50 inteiro daria prejuízo, então o clube abate até R$ 35 (o valor do
 * degradê) e o cliente paga a diferença nos cortes mais caros.
 */
const TETO_CLUBE = 3500;

const SERVICOS = [
  // nome,                    categoria,     min,  preço,  entra no clube
  ["Linha",                   "Acabamento",   10,  1500, false],
  ["Acréscimo navalhado",     "Acabamento",   10,  1500, false],
  ["Sobrancelhas",            "Acabamento",   15,  2000, false],
  ["Base do cabelo",          "Acabamento",   15,  2500, false],

  ["Corte máquina",           "Cortes",       30,  3000, true],
  ["Degradê lateral",         "Cortes",       40,  3500, true],
  ["Máquina & tesoura",       "Cortes",       45,  4500, true],
  ["Corte só na tesoura",     "Cortes",       50,  5000, true],
  ["Criança",                 "Cortes",       40,  5500, false],

  ["Barba",                   "Barba",        30,  3500, false],
  ["Barba pigmentada",        "Barba",        40,  4500, false],
  ["Barbaterapia",            "Barba",        45,  5000, false],

  ["Hidratação",              "Química",      45,  5000, false],
  ["Alisante",                "Química",      90,  8000, false],
  ["Progressiva",             "Química",     120,  9000, false],
];

const rest = (caminho, opcoes = {}) =>
  fetch(`${URL_SUPA}/rest/v1/${caminho}`, { ...opcoes, headers: h });

const [casa] = await (await rest("barbershops?select=id&slug=eq.johny-barbearia")).json();
if (!casa) {
  console.error("Barbearia não encontrada.");
  process.exit(1);
}

const usados = await (await rest("appointments?select=service_id")).json();
const emUso = new Set((usados ?? []).map((a) => a.service_id));

const antigos = await (await rest(`services?select=id,nome&barbershop_id=eq.${casa.id}`)).json();

console.log(`\n${antigos.length} serviços antigos, ${emUso.size} com agendamento.`);

for (const s of antigos) {
  if (emUso.has(s.id)) {
    // Nunca apagar serviço que já foi vendido: o histórico aponta para ele.
    await rest(`services?id=eq.${s.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ativo: false }),
    });
    console.log(`  escondido (tem histórico): ${s.nome}`);
  } else {
    await rest(`services?id=eq.${s.id}`, { method: "DELETE" });
    console.log(`  apagado: ${s.nome}`);
  }
}

const linhas = SERVICOS.map(([nome, categoria, min, preco, clube], i) => ({
  barbershop_id: casa.id,
  nome,
  categoria,
  duracao_min: min,
  preco_centavos: preco,
  coberto_pelo_clube: clube,
  abate_centavos: clube ? Math.min(TETO_CLUBE, preco) : 0,
  ativo: true,
  ordem: i,
}));

const r = await rest("services", { method: "POST", body: JSON.stringify(linhas) });
if (!r.ok) {
  console.error(await r.text());
  process.exit(1);
}

console.log(`\n${linhas.length} serviços cadastrados:\n`);
for (const s of linhas) {
  const valor = (s.preco_centavos / 100).toFixed(2).replace(".", ",");
  const clube = s.coberto_pelo_clube
    ? s.abate_centavos >= s.preco_centavos
      ? "clube cobre"
      : `clube abate R$ ${(s.abate_centavos / 100).toFixed(0)}`
    : "";
  console.log(
    `  ${s.nome.padEnd(22)} ${String(s.duracao_min).padStart(3)} min   R$ ${valor.padStart(6)}   ${clube}`,
  );
}
console.log("");
