/**
 * Química leva mais tempo que corte, então ela foge do bloco de 30 minutos.
 *
 * Alisante e progressiva ocupam 1h30. Sem isso a agenda liberaria o horário
 * seguinte e o próximo cliente chegaria com a cadeira ainda ocupada.
 *
 * Uso: node scripts/duracao-quimica.mjs
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

const LONGOS = [
  ["Alisante", 90],
  ["Progressiva", 90],
];

for (const [nome, minutos] of LONGOS) {
  const r = await fetch(
    `${URL_SUPA}/rest/v1/services?nome=eq.${encodeURIComponent(nome)}`,
    { method: "PATCH", headers: h, body: JSON.stringify({ duracao_min: minutos }) },
  );
  const [s] = await r.json();
  console.log(`  ${nome.padEnd(14)} ${s?.duracao_min ?? "?"} min`);
}

const todos = await (
  await fetch(`${URL_SUPA}/rest/v1/services?select=nome,duracao_min&order=ordem`, {
    headers: h,
  })
).json();

console.log("\nagenda por serviço:");
for (const s of todos) {
  console.log(`  ${s.nome.padEnd(22)} ${String(s.duracao_min).padStart(3)} min`);
}
console.log("");
