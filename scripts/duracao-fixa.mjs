/**
 * Deixa todo serviço com o mesmo bloco de agenda.
 *
 * Decisão do Johny: estimar duração por serviço é chute, porque o tempo real
 * varia muito de cabelo para cabelo. Então a agenda passa a trabalhar com um
 * bloco fixo, e o barbeiro se vira com o que estourar, como já faz hoje.
 *
 * Uso: node scripts/duracao-fixa.mjs [minutos]
 */

import { readFileSync } from "node:fs";

for (const linha of readFileSync(".env.local", "utf8").split("\n")) {
  const par = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (par) process.env[par[1]] = par[2].trim().replace(/^["']|["']$/g, "");
}

const MINUTOS = Number(process.argv[2] ?? 30);
const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const r = await fetch(`${URL_SUPA}/rest/v1/services?id=not.is.null`, {
  method: "PATCH",
  headers: h,
  body: JSON.stringify({ duracao_min: MINUTOS }),
});

const servicos = await r.json();
if (!r.ok) {
  console.error(servicos);
  process.exit(1);
}

console.log(`\n${servicos.length} serviços agora em ${MINUTOS} min:\n`);
for (const s of servicos.sort((a, b) => a.ordem - b.ordem)) {
  const preco = (s.preco_centavos / 100).toFixed(0).padStart(3);
  console.log(`  ${s.nome.padEnd(22)} ${s.duracao_min} min   R$ ${preco}`);
}
console.log("");
