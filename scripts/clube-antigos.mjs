/**
 * Cadastra de uma vez os assinantes antigos do clube.
 *
 *   npm run clube:antigos          # mostra o que faria, sem gravar
 *   npm run clube:antigos -- vale  # grava
 *
 * São clientes que já eram do clube antes do sistema existir. Entram no plano
 * "corte_barba_antigos", que atende de segunda a sábado — os planos novos
 * atendem só até quinta.
 *
 * O telefone é a identidade aqui: se o cliente já cortou na casa, a assinatura
 * cola no cadastro que já existe em vez de criar outro. Por isso a busca é
 * pelo número, e por isso número errado é pior que número faltando.
 */

import { readFileSync } from "node:fs";

for (const arquivo of [".env.local", ".env"]) {
  try {
    for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
      const par = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (par && !process.env[par[1]]) {
        process.env[par[1]] = par[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SEGREDO = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SLUG = process.env.NEXT_PUBLIC_BARBEARIA_SLUG ?? "johny-barbearia";
const GRAVAR = process.argv.includes("vale");

/**
 * Os oito que o Johny mandou. DDD 84, de Natal, onde é a casa.
 *
 * Três vieram com 8 dígitos (George, Daniel e Manoel Vitor) — são números
 * antigos, de antes do nono dígito. O Johny confirmou que é só pôr o 9 na
 * frente, e é o que está aqui.
 */
const ANTIGOS = [
  { nome: "Guedes", telefone: "84994804008" },
  { nome: "Islen Rocha", telefone: "84994635272" },
  { nome: "Leo", telefone: "84987334433" },
  { nome: "Albertino", telefone: "84988408829" },
  { nome: "George", telefone: "84999187078" },
  { nome: "Magno", telefone: "84996751314" },
  { nome: "Daniel", telefone: "84999388514" },
  { nome: "Manoel Vitor", telefone: "84999302299" },
];

const api = async (caminho, opcoes = {}) => {
  const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: SEGREDO,
      Authorization: `Bearer ${SEGREDO}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opcoes.headers ?? {}),
    },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
};

const [casa] = await api(`barbershops?slug=eq.${SLUG}&select=id`);
if (!casa) {
  console.error("Barbearia não encontrada.");
  process.exit(1);
}

const [plano] = await api(
  `club_plans?barbershop_id=eq.${casa.id}&slug=eq.corte_barba_antigos&select=id,nome,preco_centavos,dias_semana`,
);
if (!plano) {
  console.error("Plano dos antigos não existe. Rode a migration 0022.");
  process.exit(1);
}

const hoje = new Date();
const fim = new Date(hoje);
fim.setDate(fim.getDate() + 30);
const iso = (d) => d.toISOString().slice(0, 10);

console.log(
  `\n${GRAVAR ? "GRAVANDO" : "SIMULANDO (rode com -- vale para gravar)"}`,
);
console.log(`Plano: ${plano.nome} · dias ${plano.dias_semana.join(",")}\n`);

for (const pessoa of ANTIGOS) {
  const [existente] = await api(
    `clients?barbershop_id=eq.${casa.id}&telefone=eq.${pessoa.telefone}&select=id,nome`,
  );

  const [assinatura] = existente
    ? await api(
        `subscriptions?client_id=eq.${existente.id}&status=neq.cancelada&select=id`,
      )
    : [];

  const situacao = assinatura
    ? "JÁ TEM ASSINATURA, pulando"
    : existente
      ? `cliente já existe (${existente.nome}), só assina`
      : "cliente novo";

  console.log(`  ${pessoa.nome.padEnd(14)} ${pessoa.telefone}  ${situacao}`);

  if (!GRAVAR || assinatura) continue;

  const cliente =
    existente ??
    (
      await api("clients", {
        method: "POST",
        body: JSON.stringify({
          barbershop_id: casa.id,
          nome: pessoa.nome,
          telefone: pessoa.telefone,
        }),
      })
    )[0];

  await api("subscriptions", {
    method: "POST",
    body: JSON.stringify({
      barbershop_id: casa.id,
      client_id: cliente.id,
      plan_id: plano.id,
      status: "ativa",
      preco_centavos: plano.preco_centavos,
      cortes_mes: 0,
      ciclo_inicio: iso(hoje),
      ciclo_fim: iso(fim),
      proxima_cobranca: iso(fim),
    }),
  });
}

console.log("");
