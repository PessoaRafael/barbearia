/**
 * Aplica o expediente real em working_hours, o mesmo da migration 0006.
 * Uso: node scripts/aplicar-expediente.mjs
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

async function ajustar(filtro, abre, fecha) {
  const r = await fetch(`${URL_SUPA}/rest/v1/working_hours?${filtro}`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify({ abre, fecha }),
  });
  const linhas = await r.json();
  console.log(`${filtro} -> ${abre}–${fecha} (${linhas.length} linhas)`);
}

// Segunda a sexta
await ajustar("dia_semana=gte.1&dia_semana=lte.5", "08:30", "18:30");
// Sábado
await ajustar("dia_semana=eq.6", "08:30", "17:30");

const conferir = await (
  await fetch(
    `${URL_SUPA}/rest/v1/working_hours?select=dia_semana,abre,fecha&order=dia_semana`,
    { headers: h },
  )
).json();

const porDia = new Map();
for (const l of conferir) porDia.set(l.dia_semana, `${l.abre}–${l.fecha}`);

console.log("\nexpediente no banco:");
for (const [dia, faixa] of [...porDia.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  dia ${dia}: ${faixa}`);
}
console.log("  domingo: sem linha, não gera horário");
