/**
 * Cria uma chave de barbeiro descartável, roda o teste das telas internas com
 * ela e revoga no fim. Prova na aplicação, não só no banco, que o barbeiro
 * cai na própria agenda e não alcança o painel do dono.
 */

import { execSync } from "node:child_process";
import { randomBytes, randomInt, scryptSync } from "node:crypto";
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

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const bloco = (n) =>
  Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

const rest = (caminho, opcoes = {}) =>
  fetch(`${URL_SUPA}/rest/v1/${caminho}`, { ...opcoes, headers: h });

const dono = (
  await (await rest("access_keys?select=id&role=eq.owner&revogada_em=is.null")).json()
)[0];
const diego = (
  await (await rest("barbers?select=id,apelido&apelido=eq.Diego")).json()
)[0];

const chave = `JHNY-${bloco(4)}-${bloco(4)}`;
const sal = randomBytes(16);
const hash = `scrypt$16384$8$1$${sal.toString("hex")}$${scryptSync(chave, sal, 32, { N: 16384, r: 8, p: 1 }).toString("hex")}`;

const criada = await rest("rpc/criar_chave", {
  method: "POST",
  body: JSON.stringify({
    p_chave: dono.id,
    p_barbeiro: diego.id,
    p_hash: hash,
    p_prefixo: chave.slice(5, 9),
  }),
});

const chaveId = await criada.json();
console.log(`chave temporária do Diego criada (${chave})\n`);

let codigo = 0;
try {
  execSync("node scripts/teste-painel.mjs", { stdio: "inherit" });
} catch {
  codigo = 1;
}

await rest(`access_keys?id=eq.${chaveId}`, { method: "DELETE" });
console.log("\nchave temporária removida.");

process.exit(codigo);
