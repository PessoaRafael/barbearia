/**
 * Prova, contra o banco de verdade, as três garantias que mais importam:
 *
 *   1. a publishable key não lê nada, mesmo sabendo o nome das tabelas
 *   2. um barbeiro não enxerga a agenda de outro, nem forçando o id
 *   3. dois clientes no mesmo horário: só um entra
 *
 * Roda com: npm run teste:rls
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

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let falhas = 0;
const ok = (nome) => console.log(`  ok    ${nome}`);
const falhou = (nome, detalhe) => {
  falhas++;
  console.log(`  FALHA ${nome}`);
  if (detalhe) console.log(`        ${detalhe}`);
};

function conferir(nome, condicao, detalhe) {
  condicao ? ok(nome) : falhou(nome, detalhe);
}

const chamar = (caminho, chave, opcoes = {}) =>
  fetch(`${URL}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opcoes.headers ?? {}),
    },
  });

const rest = async (caminho) => (await chamar(caminho, SECRET)).json();
const rpc = async (nome, args) => {
  const r = await chamar(`rpc/${nome}`, SECRET, {
    method: "POST",
    body: JSON.stringify(args),
  });
  return { status: r.status, corpo: await r.json().catch(() => null) };
};

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const bloco = (n) =>
  Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
const hashChave = (chave) => {
  const sal = randomBytes(16);
  const d = scryptSync(chave, sal, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${sal.toString("hex")}$${d.toString("hex")}`;
};

// Amanhã às 10h, no fuso da casa. Domingo não conta: a casa fecha.
function proximoDiaUtil() {
  const d = new Date();
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() === 0);
  return d.toISOString().slice(0, 10);
}

console.log("");

// ---------------------------------------------------------------------------
console.log("1. A publishable key não lê nada");

for (const tabela of ["clients", "appointments", "access_keys", "payments"]) {
  const r = await chamar(`${tabela}?select=*`, PUB);
  const corpo = await r.json().catch(() => null);
  const vazio = r.status === 200 && Array.isArray(corpo) && corpo.length === 0;
  const negado = r.status === 401 || r.status === 403;
  conferir(
    `${tabela} fecha para a publishable key`,
    vazio || negado,
    `status ${r.status}: ${JSON.stringify(corpo)?.slice(0, 120)}`,
  );
}

// ---------------------------------------------------------------------------
console.log("\n2. Preparando o cenário");

const [casa] = await rest("barbershops?select=id,nome");
const barbeiros = await rest("barbers?select=id,apelido&order=ordem");
const servicos = await rest("services?select=id,nome,duracao_min&order=ordem");

const anderson = barbeiros.find((b) => b.apelido === "Anderson");
const davi = barbeiros.find((b) => b.apelido === "Davi");
const corte = servicos.find((s) => s.nome === "Corte social");

const [chaveDono] = await rest(
  "access_keys?select=id&role=eq.owner&revogada_em=is.null",
);
conferir("token do dono existe", Boolean(chaveDono?.id));

const sessao = await rpc("sessao_atual", { p_chave: chaveDono.id });
conferir(
  "sessao_atual reconhece o dono",
  sessao.corpo?.papel === "owner",
  JSON.stringify(sessao.corpo),
);

const invalida = await rpc("sessao_atual", {
  p_chave: "00000000-0000-0000-0000-000000000000",
});
conferir(
  "chave inexistente é recusada",
  invalida.status >= 400,
  `status ${invalida.status}`,
);

// Chave de barbeiro para o Davi, criada pelo dono.
const chaveDavi = `JHNY-${bloco(4)}-${bloco(4)}`;
const criada = await rpc("criar_chave", {
  p_chave: chaveDono.id,
  p_barbeiro: davi.id,
  p_hash: hashChave(chaveDavi),
  p_prefixo: chaveDavi.slice(5, 9),
});
conferir(
  "dono gera chave de barbeiro",
  criada.status === 200 && typeof criada.corpo === "string",
  JSON.stringify(criada.corpo),
);
const idChaveDavi = criada.corpo;

// Um corte na agenda do Anderson, amanhã às 10h.
const data = proximoDiaUtil();
const reserva = await rpc("reservar", {
  p_barbearia: casa.id,
  p_barbeiro: anderson.id,
  p_servico: corte.id,
  p_nome: "Cliente de Teste",
  p_telefone: "84900000001",
  p_inicio: `${data}T10:00:00-03:00`,
  p_usar_clube: false,
  p_origem: "painel",
});
conferir(
  "reserva entra na agenda do Anderson",
  reserva.status === 200 && reserva.corpo?.id,
  JSON.stringify(reserva.corpo)?.slice(0, 200),
);

// ---------------------------------------------------------------------------
console.log("\n3. Um barbeiro não vê a agenda do outro");

const comoDono = await rpc("agenda_do_dia", {
  p_chave: chaveDono.id,
  p_data: data,
});
conferir(
  "dono enxerga o corte do Anderson",
  Array.isArray(comoDono.corpo) && comoDono.corpo.length >= 1,
  JSON.stringify(comoDono.corpo)?.slice(0, 200),
);

// O ataque: Davi pede a agenda passando o id do Anderson.
const daviForcando = await rpc("agenda_do_dia", {
  p_chave: idChaveDavi,
  p_data: data,
  p_barbeiro: anderson.id,
});
conferir(
  "Davi forçando o id do Anderson recebe vazio",
  Array.isArray(daviForcando.corpo) && daviForcando.corpo.length === 0,
  JSON.stringify(daviForcando.corpo)?.slice(0, 200),
);

const daviEncerrando = await rpc("encerrar_atendimento", {
  p_chave: idChaveDavi,
  p_agendamento: reserva.corpo.id,
  p_status: "concluido",
});
conferir(
  "Davi não conclui atendimento do Anderson",
  daviEncerrando.status >= 400,
  `status ${daviEncerrando.status}: ${JSON.stringify(daviEncerrando.corpo)?.slice(0, 160)}`,
);

const daviConfirmandoPix = await rpc("decidir_pix", {
  p_chave: idChaveDavi,
  p_pagamento: "00000000-0000-0000-0000-000000000000",
  p_recebido: true,
});
conferir(
  "barbeiro não confirma pix (só o dono)",
  daviConfirmandoPix.status >= 400,
  `status ${daviConfirmandoPix.status}`,
);

const daviGerandoChave = await rpc("criar_chave", {
  p_chave: idChaveDavi,
  p_barbeiro: anderson.id,
  p_hash: hashChave("JHNY-AAAA-BBBB"),
  p_prefixo: "AAAA",
});
conferir(
  "barbeiro não gera chave de acesso",
  daviGerandoChave.status >= 400,
  `status ${daviGerandoChave.status}`,
);

// ---------------------------------------------------------------------------
console.log("\n4. Dois no mesmo horário: só um entra");

const [a, b] = await Promise.all([
  rpc("reservar", {
    p_barbearia: casa.id,
    p_barbeiro: anderson.id,
    p_servico: corte.id,
    p_nome: "Corrida A",
    p_telefone: "84900000002",
    p_inicio: `${data}T14:00:00-03:00`,
    p_usar_clube: false,
    p_origem: "link",
  }),
  rpc("reservar", {
    p_barbearia: casa.id,
    p_barbeiro: anderson.id,
    p_servico: corte.id,
    p_nome: "Corrida B",
    p_telefone: "84900000003",
    p_inicio: `${data}T14:00:00-03:00`,
    p_usar_clube: false,
    p_origem: "link",
  }),
]);

const vencedores = [a, b].filter((r) => r.status === 200).length;
conferir(
  "exatamente um dos dois passa",
  vencedores === 1,
  `A=${a.status} B=${b.status}`,
);
conferir(
  "o perdedor recebe horario_ocupado",
  [a, b].some((r) => JSON.stringify(r.corpo ?? "").includes("horario_ocupado")),
  `${JSON.stringify(a.corpo)?.slice(0, 100)} | ${JSON.stringify(b.corpo)?.slice(0, 100)}`,
);

// ---------------------------------------------------------------------------
console.log("\n5. Regras de negócio que a tela não pode furar");

const noPassado = await rpc("reservar", {
  p_barbearia: casa.id,
  p_barbeiro: anderson.id,
  p_servico: corte.id,
  p_nome: "Viajante do Tempo",
  p_telefone: "84900000004",
  p_inicio: "2020-01-02T10:00:00-03:00",
  p_usar_clube: false,
  p_origem: "link",
});
conferir(
  "horário no passado é recusado",
  JSON.stringify(noPassado.corpo ?? "").includes("horario_no_passado"),
  JSON.stringify(noPassado.corpo)?.slice(0, 160),
);

const noAlmoco = await rpc("reservar", {
  p_barbearia: casa.id,
  p_barbeiro: anderson.id,
  p_servico: corte.id,
  p_nome: "Almoço",
  p_telefone: "84900000005",
  p_inicio: `${data}T13:00:00-03:00`,
  p_usar_clube: false,
  p_origem: "link",
});
conferir(
  "almoço é recusado",
  JSON.stringify(noAlmoco.corpo ?? "").includes("horario_bloqueado"),
  JSON.stringify(noAlmoco.corpo)?.slice(0, 160),
);

const semClube = await rpc("reservar", {
  p_barbearia: casa.id,
  p_barbeiro: anderson.id,
  p_servico: corte.id,
  p_nome: "Sem Assinatura",
  p_telefone: "84900000006",
  p_inicio: `${data}T16:00:00-03:00`,
  p_usar_clube: true,
  p_origem: "link",
});
conferir(
  "crédito do clube sem assinatura é recusado",
  JSON.stringify(semClube.corpo ?? "").includes("sem_assinatura_ativa"),
  JSON.stringify(semClube.corpo)?.slice(0, 160),
);

// ---------------------------------------------------------------------------
console.log("\n6. Limpando o que o teste criou");

await chamar(`appointments?client_id=not.is.null&origem=eq.link`, SECRET);
for (const telefone of [
  "84900000001",
  "84900000002",
  "84900000003",
  "84900000004",
  "84900000005",
  "84900000006",
]) {
  const clientes = await rest(`clients?select=id&telefone=eq.${telefone}`);
  for (const c of clientes ?? []) {
    await chamar(`appointments?client_id=eq.${c.id}`, SECRET, { method: "DELETE" });
    await chamar(`clients?id=eq.${c.id}`, SECRET, { method: "DELETE" });
  }
}
await chamar(`access_keys?id=eq.${idChaveDavi}`, SECRET, { method: "DELETE" });
ok("cenário de teste removido");

console.log("");
if (falhas) {
  console.error(`${falhas} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("Todas as garantias passaram.");
