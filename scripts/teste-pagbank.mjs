/**
 * Prova a integração do PagBank contra o sandbox, antes de encostar em
 * dinheiro de verdade.
 *
 *   npm run teste:pagbank
 *
 * Responde três perguntas, nesta ordem, porque cada uma só faz sentido se a
 * anterior passou:
 *
 *   1. o token é aceito?
 *   2. dá para criar um pedido pix e receber um QR Code de volta?
 *   3. o pedido criado pode ser consultado depois?
 *
 * A pergunta 2 resolveu a dúvida que a documentação deixou em aberto, e a
 * resposta foi a pior das possíveis para o nosso fluxo: o PagBank exige
 * `customer.name`, `customer.email` E `customer.tax_id` (CPF). Testado uma a
 * uma no sandbox — sem os três, devolve 400.
 *
 * Hoje o agendamento pede nome e WhatsApp. Ligar o pix automático custa dois
 * campos a mais entre o cliente e a cadeira, e isso é decisão de negócio.
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

if (AMBIENTE === "producao") {
  console.error(
    "\nEste teste cria cobrança de verdade. Rode com PAGBANK_AMBIENTE=sandbox.\n",
  );
  process.exit(1);
}

let falhas = 0;
const conferir = (nome, condicao, detalhe) => {
  if (condicao) {
    console.log(`  ok    ${nome}`);
  } else {
    falhas++;
    console.log(`  FALHA ${nome}`);
    if (detalhe) console.log(`        ${detalhe}`);
  }
};

const chamar = async (caminho, opcoes = {}) => {
  const r = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      accept: "application/json",
      ...(opcoes.headers ?? {}),
    },
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : null, texto };
};

console.log(`\nAmbiente: ${AMBIENTE} (${BASE})\n`);

// ---------------------------------------------------------------------------
console.log("1. Pedido pix sem CPF");

const expira = new Date(Date.now() + 30 * 60 * 1000).toISOString();
const semCpf = await chamar("/orders", {
  method: "POST",
  body: JSON.stringify({
    reference_id: `teste-${Date.now()}`,
    items: [{ name: "Corte de teste", quantity: 1, unit_amount: 3000 }],
    qr_codes: [{ amount: { value: 3000 }, expiration_date: expira }],
  }),
});

const passouSemCpf = semCpf.status === 201 || semCpf.status === 200;
conferir(
  "token aceito",
  semCpf.status !== 401 && semCpf.status !== 403,
  `status ${semCpf.status}: ${semCpf.texto.slice(0, 200)}`,
);
conferir(
  "cria pedido sem pedir CPF",
  passouSemCpf,
  `status ${semCpf.status}: ${semCpf.texto.slice(0, 300)}`,
);

// ---------------------------------------------------------------------------
console.log("\n2. Pedido pix com CPF");

const comCpf = await chamar("/orders", {
  method: "POST",
  body: JSON.stringify({
    reference_id: `teste-cpf-${Date.now()}`,
    customer: {
      name: "Cliente de Teste",
      email: "teste@johnybarbearia.com.br",
      tax_id: "12345678909",
    },
    items: [{ name: "Corte de teste", quantity: 1, unit_amount: 3000 }],
    qr_codes: [{ amount: { value: 3000 }, expiration_date: expira }],
  }),
});

const pedido = comCpf.corpo;
conferir(
  "cria pedido com CPF",
  comCpf.status === 201 || comCpf.status === 200,
  `status ${comCpf.status}: ${comCpf.texto.slice(0, 300)}`,
);
conferir(
  "veio QR Code copia e cola",
  Boolean(pedido?.qr_codes?.[0]?.text),
  JSON.stringify(pedido)?.slice(0, 300),
);

if (pedido?.qr_codes?.[0]?.text) {
  console.log(`        ${pedido.qr_codes[0].text.slice(0, 60)}...`);
}

// ---------------------------------------------------------------------------
console.log("\n3. Consulta do pedido criado");

if (pedido?.id) {
  const lido = await chamar(`/orders/${pedido.id}`);
  conferir(
    "consegue consultar depois",
    lido.status === 200 && lido.corpo?.id === pedido.id,
    `status ${lido.status}`,
  );
  conferir(
    "nasce sem cobrança paga",
    !lido.corpo?.charges?.length ||
      lido.corpo.charges[0].status !== "PAID",
    JSON.stringify(lido.corpo?.charges)?.slice(0, 200),
  );
} else {
  conferir("consegue consultar depois", false, "não houve pedido para consultar");
}

console.log(
  falhas === 0
    ? "\nPagBank respondendo. Dá para seguir para o webhook.\n"
    : `\n${falhas} verificação(ões) falharam.\n`,
);

if (!passouSemCpf && (comCpf.status === 201 || comCpf.status === 200)) {
  console.log(
    "Atenção: o CPF é obrigatório. O agendamento vai precisar pedir CPF do\ncliente, e isso muda o fluxo — não é só código.\n",
  );
}

process.exit(falhas === 0 ? 0 : 1);
