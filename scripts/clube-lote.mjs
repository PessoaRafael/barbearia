/**
 * Cadastra assinantes do clube em lote e gera a chave de acesso de cada um.
 *
 *   npm run clube:lote          # simula, não grava nada
 *   npm run clube:lote -- vale  # grava
 *
 * Três planos, e a diferença que importa é o dia:
 *
 *   corte                 R$ 129,99   corte           segunda a quinta
 *   corte_barba           R$ 189,99   corte e barba   segunda a quinta
 *   corte_barba_antigos   R$ 189,99   corte e barba   segunda a SÁBADO
 *
 * O telefone é a identidade: quem já tem cadastro na casa recebe a assinatura
 * no cadastro que existe, em vez de virar cliente duplicado. Quem já tem
 * assinatura viva é pulado — renovar ou trocar de plano é decisão do Johny no
 * painel, não efeito de rodar um script duas vezes.
 *
 * As chaves saem impressas uma única vez. No banco fica só o hash, igual às
 * do Johny e dos barbeiros.
 */

import { randomBytes, randomInt, scryptSync } from "node:crypto";
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
 * Os números vieram do Johny em formatos misturados: alguns com 9 dígitos,
 * outros com 8 (de antes do nono dígito). Ele confirmou que nos de 8 é só pôr
 * o 9 na frente. Aqui já estão todos completos, com DDD, para não sobrar
 * conversão adivinhada no meio do caminho.
 *
 * Um deles é do Rio (Vitor, DDD 21). O resto é 84, de Natal.
 */
const LISTA = [
  // Antigos: atendem até sábado.
  { nome: "Guedes", telefone: "84994804008", plano: "corte_barba_antigos" },
  { nome: "Islen Rocha", telefone: "84994635272", plano: "corte_barba_antigos" },
  { nome: "Leo", telefone: "84987334433", plano: "corte_barba_antigos" },
  { nome: "Albertino", telefone: "84988408829", plano: "corte_barba_antigos" },
  { nome: "George", telefone: "84999187078", plano: "corte_barba_antigos" },
  { nome: "Magno", telefone: "84996751314", plano: "corte_barba_antigos" },
  { nome: "Daniel", telefone: "84999388514", plano: "corte_barba_antigos" },
  { nome: "Manoel Vitor", telefone: "84999302299", plano: "corte_barba_antigos" },

  // Novos: segunda a quinta.
  { nome: "Alison", telefone: "84999380827", plano: "corte_barba" },
  { nome: "Gutenberg", telefone: "84991541515", plano: "corte" },
  { nome: "Xavier", telefone: "84996253636", plano: "corte" },
  { nome: "Maicon", telefone: "84991836793", plano: "corte" },
  { nome: "Pedro Henrique", telefone: "84991928041", plano: "corte_barba" },
  { nome: "Vitor", telefone: "84998299358", plano: "corte_barba" },
  { nome: "Calebe", telefone: "84996601702", plano: "corte" },
  { nome: "Manuel Lopes", telefone: "84999380686", plano: "corte_barba" },
  { nome: "Israel", telefone: "84999978678", plano: "corte" },
  { nome: "Rafael", telefone: "84988081985", plano: "corte" },
  { nome: "Ricardo", telefone: "84986381949", plano: "corte_barba" },
  { nome: "Rodrigo", telefone: "84998062105", plano: "corte" },
  { nome: "Bruno", telefone: "84997082424", plano: "corte" },
  { nome: "Jefferson", telefone: "84999683101", plano: "corte_barba" },
  { nome: "Junior Rodrigues", telefone: "84996397579", plano: "corte" },
  { nome: "Lucas", telefone: "84999995368", plano: "corte" },
  { nome: "Pedro", telefone: "84988453312", plano: "corte_barba" },
  { nome: "Vitor (RJ)", telefone: "21975944056", plano: "corte" },
  { nome: "Alexsandro", telefone: "84988149676", plano: "corte" },
  { nome: "Gabriel", telefone: "84999916292", plano: "corte_barba" },
  { nome: "Stênio", telefone: "84996085088", plano: "corte_barba" },
  { nome: "Ângelo", telefone: "84991001936", plano: "corte_barba" },
  { nome: "Enoque", telefone: "84986339095", plano: "corte" },
  { nome: "Lucas Peres", telefone: "84996475849", plano: "corte_barba" },
  { nome: "Gabriel R.", telefone: "84999191802", plano: "corte_barba" },
  { nome: "Heron", telefone: "84999215420", plano: "corte_barba" },
  { nome: "Jefferson S.", telefone: "84996241947", plano: "corte_barba" },
  { nome: "Kel", telefone: "84981894481", plano: "corte" },
  { nome: "Luan", telefone: "84981502024", plano: "corte" },
  { nome: "Lucas Medeiros", telefone: "84994213183", plano: "corte" },
  { nome: "Lucas C.", telefone: "84991417839", plano: "corte" },
  { nome: "Tiago", telefone: "84999840377", plano: "corte" },
  { nome: "Daniel S.", telefone: "84998376783", plano: "corte_barba" },
  { nome: "Leo Mari", telefone: "84999014844", plano: "corte_barba" },
  { nome: "Esdras", telefone: "84996577744", plano: "corte" },
  { nome: "Jean", telefone: "84999865009", plano: "corte" },
  { nome: "Kelven", telefone: "84996886183", plano: "corte_barba" },
  { nome: "Portela", telefone: "84999998420", plano: "corte_barba" },
  { nome: "Manoel Neto", telefone: "84981895150", plano: "corte" },
  { nome: "Renato Sussuarana", telefone: "84991938621", plano: "corte_barba" },
];

// Mesmo alfabeto e mesmo hash de lib/auth/chaves.ts: sem O, I, 0 e 1, que são
// os quatro que fazem alguém digitar errado ao ler em voz alta no WhatsApp.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const bloco = (n) =>
  Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

const hashChave = (chave) => {
  const sal = randomBytes(16);
  const d = scryptSync(chave, sal, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${sal.toString("hex")}$${d.toString("hex")}`;
};

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

const planos = await api(
  `club_plans?barbershop_id=eq.${casa.id}&select=id,slug,nome,preco_centavos,dias_semana,duracao_dias`,
);
const porSlug = new Map(planos.map((p) => [p.slug, p]));

for (const slug of new Set(LISTA.map((p) => p.plano))) {
  if (!porSlug.has(slug)) {
    console.error(`Plano "${slug}" não existe. Rode as migrations do clube.`);
    process.exit(1);
  }
}

const hoje = new Date();
const iso = (d) => d.toISOString().slice(0, 10);

console.log(
  `\n${GRAVAR ? "GRAVANDO" : "SIMULANDO — rode com: npm run clube:lote -- vale"}\n`,
);

const chaves = [];
let novos = 0;
let pulados = 0;

for (const pessoa of LISTA) {
  const plano = porSlug.get(pessoa.plano);

  const [existente] = await api(
    `clients?barbershop_id=eq.${casa.id}&telefone=eq.${pessoa.telefone}&select=id,nome`,
  );

  const [assinatura] = existente
    ? await api(
        `subscriptions?client_id=eq.${existente.id}&status=neq.cancelada&select=id,plan_id`,
      )
    : [];

  if (assinatura) {
    pulados++;
    const mesmo = assinatura.plan_id === plano.id;
    console.log(
      `  ${pessoa.nome.padEnd(19)} ${pessoa.telefone}  JÁ ASSINA${mesmo ? "" : " — em OUTRO plano, confira"} (cadastro: ${existente.nome})`,
    );
    continue;
  }

  novos++;
  console.log(
    `  ${pessoa.nome.padEnd(19)} ${pessoa.telefone}  ${plano.nome} · ${existente ? `cadastro existe (${existente.nome})` : "cliente novo"}`,
  );

  if (!GRAVAR) continue;

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

  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + (plano.duracao_dias ?? 30));

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

console.log(`\n  ${novos} para cadastrar · ${pulados} já assinam`);

/**
 * Segunda passada: chave para todo assinante ativo que ainda não tem.
 *
 * Separada da primeira de propósito. Quem já assinava antes deste script
 * também precisa de chave, e amarrar a geração ao cadastro deixaria essa
 * gente de fora justamente por já estar em dia.
 */
const ativos = await api(
  `subscriptions?barbershop_id=eq.${casa.id}&status=eq.ativa&select=client_id,clients(nome,telefone)`,
);

const comChave = new Set(
  (
    await api(
      `access_keys?barbershop_id=eq.${casa.id}&role=eq.client&revogada_em=is.null&select=client_id`,
    )
  ).map((k) => k.client_id),
);

const semChave = ativos.filter((a) => !comChave.has(a.client_id));
console.log(`  ${semChave.length} assinante(s) sem chave de acesso`);

for (const a of semChave) {
  const c = Array.isArray(a.clients) ? a.clients[0] : a.clients;

  if (!GRAVAR) {
    console.log(`    geraria chave para ${c?.nome}`);
    continue;
  }

  const chave = `JHNY-${bloco(4)}-${bloco(4)}`;
  await api("access_keys", {
    method: "POST",
    body: JSON.stringify({
      barbershop_id: casa.id,
      client_id: a.client_id,
      role: "client",
      key_hash: hashChave(chave),
      key_prefix: chave.slice(5, 9),
    }),
  });

  chaves.push({ nome: c?.nome ?? "?", telefone: c?.telefone ?? "", chave });
}

if (chaves.length) {
  console.log(
    "\n" +
      "=".repeat(62) +
      "\nCHAVES DE ACESSO — aparecem só aqui, no banco fica o hash\n" +
      "=".repeat(62),
  );
  for (const c of chaves) {
    console.log(`\n${c.nome} — ${c.telefone}`);
    console.log(`  ${c.chave}`);
  }
  console.log(
    "\n" +
      "=".repeat(62) +
      "\nCopie agora. Quem perder, o Johny gera outra na aba Clube.\n",
  );
}
