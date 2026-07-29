/**
 * Derruba o cache das páginas públicas depois de mexer no banco por fora do
 * app. Uso: node scripts/revalidar.mjs [url-base]
 */

import { readFileSync } from "node:fs";

for (const linha of readFileSync(".env.local", "utf8").split("\n")) {
  const par = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (par) process.env[par[1]] = par[2].trim().replace(/^["']|["']$/g, "");
}

const base = process.argv[2] ?? "http://localhost:3000";

const r = await fetch(`${base}/api/revalidar`, {
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
});

console.log(`${base}/api/revalidar -> ${r.status}`);
console.log(await r.text());
