/**
 * Gera (ou regera) o token de super user do Johny.
 *
 *   node scripts/token-owner.mjs
 *
 * Imprime o código UMA vez e guarda só o hash. Regerar invalida o anterior e
 * derruba as sessões abertas. É também o caminho de recuperação: se o Johny
 * perder o token, roda de novo.
 *
 * O formato do hash é o mesmo de lib/auth/chaves.ts, se mudar lá, mude aqui.
 */

import { randomInt, randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const N = 16384;
const R = 8;
const P = 1;

function carregarEnv() {
  for (const arquivo of [".env.local", ".env"]) {
    try {
      for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
        const par = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (par && !process.env[par[1]]) {
          process.env[par[1]] = par[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // arquivo ausente é normal
    }
  }
}

const bloco = (n) =>
  Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

function hashChave(chave) {
  const sal = randomBytes(16);
  const derivada = scryptSync(chave, sal, 32, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString("hex")}$${derivada.toString("hex")}`;
}

async function api(caminho, opcoes = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chave) {
    console.error(
      "Faltou NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY. Confira o .env.local.",
    );
    process.exit(1);
  }

  const resposta = await fetch(`${url}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opcoes.headers ?? {}),
    },
  });

  if (!resposta.ok) {
    console.error(`Supabase respondeu ${resposta.status}: ${await resposta.text()}`);
    process.exit(1);
  }

  return resposta.status === 204 ? null : resposta.json();
}

carregarEnv();

const slug = process.env.NEXT_PUBLIC_BARBEARIA_SLUG ?? "johny-barbearia";
const casas = await api(`barbershops?slug=eq.${slug}&select=id,nome`);

if (!casas?.length) {
  console.error(`Barbearia "${slug}" não existe. Rode as migrations e o seed.`);
  process.exit(1);
}

const casa = casas[0];
const agora = new Date().toISOString();

// Uma chave de owner viva por vez: as antigas caem junto.
await api(
  `access_keys?barbershop_id=eq.${casa.id}&role=eq.owner&revogada_em=is.null`,
  { method: "PATCH", body: JSON.stringify({ revogada_em: agora }) },
);

const chave = `JHNY-${bloco(4)}-${bloco(4)}`;

await api("access_keys", {
  method: "POST",
  body: JSON.stringify({
    barbershop_id: casa.id,
    barber_id: null,
    role: "owner",
    key_hash: hashChave(chave),
    key_prefix: chave.slice(5, 9),
  }),
});

console.log("");
console.log(`  Token de super user, ${casa.nome}`);
console.log("");
console.log(`      ${chave}`);
console.log("");
console.log("  Anote agora: ele não aparece de novo.");
console.log("  Qualquer token de owner anterior acabou de ser revogado.");
console.log("");
