import "server-only";

import type { Cobranca, ProvedorPagamento, StatusCobranca } from "./provider";

/**
 * PagBank, pelo endpoint de pedidos com QR Code.
 *
 * Um pedido com `qr_codes` só aceita pix, e o QR vale para um pagamento só —
 * o que casa com o nosso caso: uma cobrança por agendamento.
 *
 * Nada aqui está ligado ainda. `provedorAtual()` só troca de provedor quando
 * PAGBANK_ATIVO for "true", e isso não deve acontecer antes de a integração
 * ser testada contra o sandbox. Código de pagamento escrito e não provado é
 * exatamente o tipo de coisa que falha com o dinheiro do cliente.
 */

const BASES = {
  sandbox: "https://sandbox.api.pagseguro.com",
  producao: "https://api.pagseguro.com",
} as const;

function config() {
  const token = process.env.PAGBANK_TOKEN;
  if (!token) throw new Error("PAGBANK_TOKEN não configurado.");

  const ambiente =
    process.env.PAGBANK_AMBIENTE === "producao" ? "producao" : "sandbox";

  return { token, base: BASES[ambiente], ambiente };
}

async function chamar(caminho: string, opcoes: RequestInit = {}) {
  const { token, base } = config();

  const resposta = await fetch(`${base}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      accept: "application/json",
      ...(opcoes.headers ?? {}),
    },
    cache: "no-store",
  });

  const texto = await resposta.text();
  const corpo = texto ? JSON.parse(texto) : null;

  if (!resposta.ok) {
    // A mensagem do PagBank vai para o log, nunca para a tela do cliente:
    // ela cita campo interno e não ajuda quem só quer pagar o corte.
    console.error("pagbank", resposta.status, texto.slice(0, 500));
    throw new Error(`pagbank_${resposta.status}`);
  }

  return corpo;
}

/**
 * Traduz o estado do pedido para os quatro que o resto do sistema conhece.
 *
 * Vale para a cobrança (charges) e para o QR: o pedido nasce sem charge
 * nenhuma e só ganha uma quando alguém paga.
 */
function traduzir(pedido: {
  charges?: { status?: string }[];
  qr_codes?: { expiration_date?: string }[];
}): StatusCobranca {
  const status = pedido.charges?.[0]?.status;

  if (status === "PAID") return "confirmado";
  if (status === "DECLINED" || status === "CANCELED") return "negado";

  const vence = pedido.qr_codes?.[0]?.expiration_date;
  if (vence && new Date(vence) < new Date()) return "expirado";

  return "aguardando";
}

export const pagbank: ProvedorPagamento = {
  nome: "pagbank",
  confirmaSozinho: true,
  pedeCpf: true,

  async criarCobranca({
    agendamentoId,
    valorCentavos,
    minutos,
    cliente,
  }): Promise<Cobranca> {
    const expiraEm = new Date(Date.now() + minutos * 60 * 1000);
    const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");

    const cpf = (cliente.cpf ?? "").replace(/\D/g, "");
    if (!cliente.email || cpf.length !== 11) {
      // Falha cedo e com nome claro: sem isso o PagBank devolve 400 e o
      // cliente veria "não consegui marcar" sem ninguém saber o porquê.
      throw new Error("pagbank_faltou_cpf_ou_email");
    }

    const telefone = cliente.telefone.replace(/\D/g, "").slice(-11);

    const pedido = await chamar("/orders", {
      method: "POST",
      body: JSON.stringify({
        // O id do agendamento volta em toda notificação: é por ele que a
        // gente reencontra a cadeira certa sem depender de tabela de-para.
        reference_id: agendamentoId,
        customer: {
          name: cliente.nome,
          email: cliente.email,
          tax_id: cpf,
          ...(telefone.length >= 10
            ? {
                phones: [
                  {
                    country: "55",
                    area: telefone.slice(0, 2),
                    number: telefone.slice(2),
                    type: "MOBILE",
                  },
                ],
              }
            : {}),
        },
        items: [
          { name: "Serviço na Johny Barbearia", quantity: 1, unit_amount: valorCentavos },
        ],
        qr_codes: [
          {
            amount: { value: valorCentavos },
            expiration_date: expiraEm.toISOString(),
          },
        ],
        ...(site ? { notification_urls: [`${site}/api/webhook/pagbank`] } : {}),
      }),
    });

    const qr = pedido?.qr_codes?.[0];
    if (!qr?.text) throw new Error("pagbank_sem_qrcode");

    return {
      txid: pedido.id,
      brcode: qr.text,
      valorCentavos,
      expiraEm,
    };
  },

  async consultarStatus(txid) {
    try {
      return traduzir(await chamar(`/orders/${txid}`));
    } catch {
      // Falha de rede não é "não pagou": deixa como está e tenta depois.
      return "aguardando";
    }
  },

  /**
   * O corpo da notificação serve para saber QUAL pedido mexeu, e mais nada.
   *
   * O status vem de uma consulta nossa ao PagBank, não do que chegou. Assim a
   * integração não depende de conferir assinatura para ser segura: mesmo que
   * alguém descubra o endereço e mande um "pago" falso, a confirmação só
   * acontece se o PagBank confirmar quando a gente perguntar.
   */
  async webhook(corpo) {
    const dados = corpo as { id?: string; reference_id?: string } | null;
    const id = dados?.id;
    if (!id) return null;

    return { txid: id, status: await pagbank.consultarStatus(id) };
  },
};
