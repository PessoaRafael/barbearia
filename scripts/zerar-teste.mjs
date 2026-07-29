/**
 * Apaga os dados de teste e mantém a configuração da casa.
 *
 * Vai embora: agendamento, cliente, pagamento, assinatura, caixa, fila, aviso,
 * auditoria, bloqueio pontual e tentativa de login.
 * Fica: barbearia, barbeiros, serviços, expediente, almoço, feriados e as
 * chaves de acesso, senão você perderia o token do Johny.
 *
 * Uso: node scripts/zerar-teste.mjs          (só mostra o que existe)
 *      node scripts/zerar-teste.mjs --apagar (apaga de verdade)
 */

import { readFileSync } from "node:fs";

for (const linha of readFileSync(".env.local", "utf8").split("\n")) {
  const par = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (par) process.env[par[1]] = par[2].trim().replace(/^["']|["']$/g, "");
}

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: SECRET, Authorization: `Bearer ${SECRET}` };

const apagar = process.argv.includes("--apagar");

async function contar(tabela, filtro = "") {
  const r = await fetch(
    `${URL_SUPA}/rest/v1/${tabela}?select=id${filtro ? "&" + filtro : ""}`,
    { headers: { ...h, Prefer: "count=exact", Range: "0-0" } },
  );
  const faixa = r.headers.get("content-range") ?? "0/0";
  return Number(faixa.split("/")[1] ?? 0);
}

// A ordem respeita as chaves estrangeiras: filho antes do pai.
const LIMPAR = [
  ["subscription_uses", "id=not.is.null"],
  ["payments", "id=not.is.null"],
  ["cash_entries", "id=not.is.null"],
  ["waitlist", "id=not.is.null"],
  ["notifications", "id=not.is.null"],
  ["appointments", "id=not.is.null"],
  ["subscriptions", "id=not.is.null"],
  ["clients", "id=not.is.null"],
  // Só bloqueio pontual: o almoço é recorrente (dia_semana) e fica.
  ["breaks", "data=not.is.null"],
];

const MANTER = ["barbershops", "barbers", "services", "working_hours", "access_keys"];

console.log("");
console.log("Vai apagar:");
for (const [tabela, filtro] of LIMPAR) {
  console.log(`  ${String(await contar(tabela, filtro)).padStart(4)}  ${tabela}`);
}

console.log("\nFica de pé:");
for (const tabela of MANTER) {
  console.log(`  ${String(await contar(tabela)).padStart(4)}  ${tabela}`);
}

if (!apagar) {
  console.log("\nNada foi apagado. Rode com --apagar para valer.");
  process.exit(0);
}

console.log("\nApagando...");
for (const [tabela, filtro] of LIMPAR) {
  const r = await fetch(`${URL_SUPA}/rest/v1/${tabela}?${filtro}`, {
    method: "DELETE",
    headers: h,
  });
  console.log(`  ${tabela}: ${r.status === 204 ? "ok" : `HTTP ${r.status}`}`);
}

// audit_log e login_attempts usam bigserial, não uuid.
for (const tabela of ["audit_log", "login_attempts"]) {
  const r = await fetch(`${URL_SUPA}/rest/v1/${tabela}?id=gt.0`, {
    method: "DELETE",
    headers: h,
  });
  console.log(`  ${tabela}: ${r.status === 204 ? "ok" : `HTTP ${r.status}`}`);
}

console.log("\nConferindo:");
for (const [tabela, filtro] of LIMPAR) {
  console.log(`  ${String(await contar(tabela, filtro)).padStart(4)}  ${tabela}`);
}
console.log("");
