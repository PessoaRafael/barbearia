/**
 * Diagnóstico para mandar ao suporte do PagBank.
 *
 *   npm run pagbank:diagnostico
 *
 * Separa duas coisas que o atendimento costuma confundir:
 *
 *   1. a conta responde? (criar chave pública — inofensivo, não cobra ninguém)
 *   2. a conta pode criar pedidos? (consulta em /orders)
 *
 * Se a 1 passa e a 2 dá 403, está provado que o token é válido e o que falta é
 * liberação da conta para a API de pedidos. É esse recorte que faz o suporte
 * parar de pedir para conferir credencial.
 *
 * Nenhuma chamada aqui cria cobrança nem move dinheiro.
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

const TOKEN = process.env.PAGBANK_TOKEN;
const AMBIENTE = process.env.PAGBANK_AMBIENTE ?? "sandbox";
const BASE =
  AMBIENTE === "producao"
    ? "https://api.pagseguro.com"
    : "https://sandbox.api.pagseguro.com";

if (!TOKEN) {
  console.error("\nFaltou PAGBANK_TOKEN no .env.local.\n");
  process.exit(1);
}

const chamar = async (caminho, opcoes = {}) => {
  const inicio = Date.now();
  const r = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      accept: "application/json",
      ...(opcoes.headers ?? {}),
    },
  });
  return {
    status: r.status,
    ms: Date.now() - inicio,
    corpo: (await r.text()).slice(0, 400),
  };
};

console.log(`
==================================================================
DIAGNÓSTICO PAGBANK — ${new Date().toISOString()}
ambiente: ${AMBIENTE}
base:     ${BASE}
token:    ...${TOKEN.slice(-6)}  (só o fim, para conferência)
==================================================================`);

// 1. A conta responde? Criar chave pública não cobra ninguém.
const chave = await chamar("/public-keys", {
  method: "POST",
  body: JSON.stringify({ type: "card" }),
});
console.log(`
[1] POST /public-keys  (type: card)
    status ${chave.status} em ${chave.ms}ms
    ${chave.corpo.slice(0, 160)}`);

// 2. A conta pode mexer em pedidos? Consulta de um id que não existe:
//    404 significa "pode, mas não achei"; 403 significa "não pode".
const pedido = await chamar("/orders/ORDE_00000000-0000-0000-0000-000000000000");
console.log(`
[2] GET /orders/{id inexistente}
    status ${pedido.status} em ${pedido.ms}ms
    ${pedido.corpo.slice(0, 300)}`);

console.log(`
------------------------------------------------------------------
LEITURA`);

if (chave.status === 201 || chave.status === 200) {
  console.log("  · o token é válido: a conta respondeu e gerou chave pública");
} else if (chave.status === 401) {
  console.log("  · TOKEN INVÁLIDO: nem a chave pública saiu (401)");
} else {
  console.log(`  · chave pública devolveu ${chave.status}, fora do esperado`);
}

if (pedido.status === 403) {
  console.log(
    "  · a conta NÃO está liberada para a API de pedidos (403 ACCESS_DENIED)",
  );
  console.log("  · é isso que precisa de homologação, não de credencial nova");
} else if (pedido.status === 404) {
  console.log("  · a conta PODE usar a API de pedidos (404 = id não existe, e tudo bem)");
} else {
  console.log(`  · /orders devolveu ${pedido.status}`);
}

console.log(`------------------------------------------------------------------
`);
