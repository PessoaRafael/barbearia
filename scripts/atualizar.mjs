/**
 * Derruba o cache das páginas públicas.
 *
 *   npm run atualizar                      # localhost:3000
 *   npm run atualizar -- https://seu.site  # produção
 *
 * A landing, o /agendar e o /bot são gerados uma vez e reaproveitados por dez
 * minutos. O painel derruba esse cache sozinho quando salva, mas mudança feita
 * por fora (SQL no Supabase, script, seed) não avisa ninguém: a tela fica
 * mostrando dado velho sem nada parecer errado. É para esse caso que isto
 * existe.
 */

import { readFileSync } from "node:fs";

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

const segredo = process.env.CRON_SECRET;
if (!segredo) {
  console.error("Faltou CRON_SECRET no .env.local.");
  process.exit(1);
}

const base = (
  process.argv[2] ??
  process.env.SITE_URL ??
  "http://127.0.0.1:3000"
).replace(/\/$/, "");

const resposta = await fetch(`${base}/api/revalidar`, {
  headers: { Authorization: `Bearer ${segredo}` },
}).catch((erro) => {
  console.error(`Não consegui falar com ${base}: ${erro.message}`);
  process.exit(1);
});

const corpo = await resposta.text();

if (!resposta.ok) {
  console.error(`${base} respondeu ${resposta.status}: ${corpo}`);
  process.exit(1);
}

console.log(`Cache derrubado em ${base}: ${corpo}`);
console.log("A próxima visita já monta a página com o dado novo.");
