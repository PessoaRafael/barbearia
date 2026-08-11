import "server-only";

import { gerarBrCode } from "@/lib/pix/brcode";
import { pagbank } from "./pagbank";

/**
 * Camada isolada de pagamento.
 *
 * Hoje o pix é BR Code estático com valor e txid, e quem confirma é o Johny
 * olhando o extrato, nunca a palavra do cliente. Quando entrar um PSP com
 * webhook, basta escrever outro objeto com esta mesma interface: nada fora
 * daqui sabe como a cobrança é criada ou confirmada.
 */

export type Cobranca = {
  txid: string;
  brcode: string;
  valorCentavos: number;
  expiraEm: Date;
};

export type StatusCobranca = "aguardando" | "confirmado" | "negado" | "expirado";

export interface ProvedorPagamento {
  readonly nome: string;
  /** Confirmação chega sozinha por webhook? Hoje, não. */
  readonly confirmaSozinho: boolean;
  /** Exige CPF e e-mail do cliente? A tela só pede o que for necessário. */
  readonly pedeCpf: boolean;

  criarCobranca(entrada: {
    barbeariaId: string;
    agendamentoId: string;
    valorCentavos: number;
    chavePix: string;
    titular: string;
    cidade: string;
    minutos: number;
    /**
     * Quem vai pagar. O pix manual não usa nada disso — o BR Code é do Johny,
     * não do cliente. O PagBank exige nome, e-mail e CPF, e é por isso que o
     * campo existe na interface: um provedor precisa, o outro ignora.
     */
    cliente: {
      nome: string;
      telefone: string;
      email?: string | null;
      cpf?: string | null;
    };
  }): Promise<Cobranca>;

  consultarStatus(txid: string): Promise<StatusCobranca>;

  webhook(corpo: unknown): Promise<{
    txid: string;
    status: StatusCobranca;
  } | null>;
}

/** Gera um txid curto e estável a partir do id do agendamento. */
function txidDe(agendamentoId: string) {
  return `JHNY${agendamentoId.replace(/-/g, "").slice(0, 20)}`.toUpperCase();
}

export const pixManual: ProvedorPagamento = {
  nome: "pix-manual",
  confirmaSozinho: false,
  pedeCpf: false,

  async criarCobranca({
    agendamentoId,
    valorCentavos,
    chavePix,
    titular,
    cidade,
    minutos,
  }) {
    const txid = txidDe(agendamentoId);

    return {
      txid,
      valorCentavos,
      brcode: gerarBrCode({
        chave: chavePix,
        titular,
        cidade,
        valorCentavos,
        txid,
      }),
      expiraEm: new Date(Date.now() + minutos * 60 * 1000),
    };
  },

  async consultarStatus() {
    // Sem PSP não há o que consultar: quem decide é o Johny no painel.
    return "aguardando";
  },

  async webhook() {
    return null;
  },
};

/**
 * Duas chaves para virar o provedor, e é de propósito.
 *
 * Só o token existir não basta: PAGBANK_ATIVO precisa ser "true". Assim
 * colocar a credencial no ambiente para testar não muda, sozinho, por onde o
 * dinheiro do Johny passa.
 */
export function provedorAtual(): ProvedorPagamento {
  if (process.env.PAGBANK_ATIVO === "true" && process.env.PAGBANK_TOKEN) {
    return pagbank;
  }
  return pixManual;
}
