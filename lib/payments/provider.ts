import "server-only";

import { gerarBrCode } from "@/lib/pix/brcode";

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

  criarCobranca(entrada: {
    barbeariaId: string;
    agendamentoId: string;
    valorCentavos: number;
    chavePix: string;
    titular: string;
    cidade: string;
    minutos: number;
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

export function provedorAtual(): ProvedorPagamento {
  return pixManual;
}
