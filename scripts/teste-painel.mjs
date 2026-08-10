/**
 * Testa as telas internas contra o servidor local, forjando um cookie de sessão
 * válido, o mesmo que o /entrar emite. Prova que o portão fecha para anônimo,
 * que o dono vê o painel e que cada papel cai na sua tela.
 *
 * Precisa do `npm run dev` rodando. Uso: node scripts/teste-painel.mjs
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

for (const linha of readFileSync(".env.local", "utf8").split("\n")) {
  const par = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (par) process.env[par[1]] = par[2].trim().replace(/^["']|["']$/g, "");
}

const BASE = "http://localhost:3000";
const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: SECRET, Authorization: `Bearer ${SECRET}` };

let falhas = 0;
const conferir = (nome, ok, detalhe) => {
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome}`);
  if (!ok && detalhe) console.log(`        ${detalhe}`);
};

// O cookie carrega a casa junto (campo b), como o de produção: é com ele que
// a tela dispara a consulta em paralelo com a conferência da sessão.
function cookieDe(chaveId, papel, barbeariaId) {
  const corpo = Buffer.from(
    JSON.stringify({ k: chaveId, b: barbeariaId }),
  ).toString("base64url");
  const assinatura = createHmac("sha256", process.env.SESSION_SECRET)
    .update(corpo)
    .digest("base64url");
  return `johny_sessao=${corpo}.${assinatura}; johny_papel=${papel}`;
}

const rest = (caminho) =>
  fetch(`${URL_SUPA}/rest/v1/${caminho}`, { headers: h }).then((r) => r.json());

console.log("");
console.log("1. Sem sessão, tela interna não abre");

for (const rota of ["/painel", "/agenda"]) {
  const r = await fetch(BASE + rota, { redirect: "manual" });
  conferir(
    `${rota} manda para /entrar`,
    r.status >= 300 && r.status < 400 && (r.headers.get("location") ?? "").includes("/entrar"),
    `status ${r.status} -> ${r.headers.get("location")}`,
  );
}

const cookieRuim = "johny_sessao=xxx.yyy; johny_papel=owner";
const forjado = await fetch(BASE + "/painel", {
  headers: { cookie: cookieRuim },
  redirect: "manual",
});
conferir(
  "cookie com assinatura falsa é recusado",
  forjado.status >= 300 && forjado.status < 400,
  `status ${forjado.status}`,
);

console.log("\n2. Como dono");

const chaves = await rest(
  "access_keys?select=id,role,barber_id,barbershop_id&revogada_em=is.null",
);
const dono = chaves.find((c) => c.role === "owner");
conferir("chave de dono existe no banco", Boolean(dono));

const cookieDono = cookieDe(dono.id, "owner", dono.barbershop_id);

for (const aba of ["agenda", "pix", "clube", "clientes", "servicos", "caixa", "equipe", "config"]) {
  const r = await fetch(`${BASE}/painel?aba=${aba}`, { headers: { cookie: cookieDono } });
  conferir(`aba ${aba} responde`, r.status === 200, `status ${r.status}`);
}

const equipe = await (
  await fetch(`${BASE}/painel?aba=equipe`, { headers: { cookie: cookieDono } })
).text();
for (const alvo of ["Johny", "Anderson", "Davi"]) {
  conferir(`equipe mostra "${alvo}"`, equipe.includes(alvo));
}
// O rótulo do botão depende de o barbeiro já ter chave viva ou não. Fixar um
// dos dois fazia o teste falhar só porque alguém tinha gerado chave antes.
conferir(
  "equipe tem o botão de chave",
  /Gerar (chave|outra)/.test(equipe),
);

const config = await (
  await fetch(`${BASE}/painel?aba=config`, { headers: { cookie: cookieDono } })
).text();
for (const alvo of ["84999835180", "Johny Rodrigues Gomes", "Minutos de reserva"]) {
  conferir(`ajustes mostram "${alvo}"`, config.includes(alvo));
}

const donoNaAgenda = await fetch(BASE + "/agenda", {
  headers: { cookie: cookieDono },
  redirect: "manual",
});
conferir(
  "dono em /agenda volta para /painel",
  (donoNaAgenda.headers.get("location") ?? "").includes("/painel"),
  `status ${donoNaAgenda.status} -> ${donoNaAgenda.headers.get("location")}`,
);

console.log("\n3. Como barbeiro");

const chaveBarbeiro = chaves.find((c) => c.role === "barber");
if (!chaveBarbeiro) {
  console.log("  (pulado) nenhum barbeiro tem chave ainda, gere pela aba Equipe");
} else {
  const cookieBarbeiro = cookieDe(
    chaveBarbeiro.id,
    "barber",
    chaveBarbeiro.barbershop_id ?? dono.barbershop_id,
  );

  const propria = await fetch(BASE + "/agenda", { headers: { cookie: cookieBarbeiro } });
  conferir("barbeiro abre a própria agenda", propria.status === 200, `status ${propria.status}`);

  const painel = await fetch(BASE + "/painel", {
    headers: { cookie: cookieBarbeiro },
    redirect: "manual",
  });
  conferir(
    "barbeiro no /painel é mandado para /agenda",
    (painel.headers.get("location") ?? "").includes("/agenda"),
    `status ${painel.status} -> ${painel.headers.get("location")}`,
  );

  const html = await propria.text();
  conferir(
    "agenda do barbeiro não mostra faturamento da casa",
    !html.includes("painel do Johny"),
  );
}

console.log("");
if (falhas) {
  console.error(`${falhas} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("Telas internas ok.");
