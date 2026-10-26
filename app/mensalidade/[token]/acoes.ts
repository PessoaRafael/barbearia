"use server";

import { clienteDoToken, linkDaMensalidade } from "@/lib/clube/link";
import { mensalidadeDe } from "@/lib/clube/mensalidade";
import {
  cobrarMensalidadeNaInfinitepay,
  infinitepayLigado,
} from "@/lib/payments/infinitepay";

/**
 * Abre a página da InfinitePay com a mensalidade de quem tem o link.
 *
 * O valor sai do plano no banco, e quem é o cliente sai do link assinado:
 * nada do que a tela manda decide preço nem de quem é o pagamento.
 */
export async function pagarMensalidade(token: string) {
  const clienteId = clienteDoToken(token);
  if (!clienteId) return { erro: "Esse link não vale mais. Peça outro ao Johny." };

  if (!infinitepayLigado()) {
    return { erro: "O pagamento online está fora do ar. Chame o Johny no WhatsApp." };
  }

  const m = await mensalidadeDe(clienteId);
  if (!m?.plano) {
    return { erro: "Não achei seu plano. Chame o Johny no WhatsApp." };
  }

  try {
    const url = await cobrarMensalidadeNaInfinitepay({
      barbeariaId: m.barbeariaId,
      clienteId,
      planoId: m.plano.id,
      valorCentavos: m.plano.precoCentavos,
      descricao: `Mensalidade ${m.plano.nome}`,
      clienteNome: m.nome,
      volta: linkDaMensalidade(clienteId),
    });
    return { url };
  } catch (erro) {
    console.error("infinitepay mensalidade:", (erro as Error).message);
    return { erro: "Não consegui abrir o pagamento agora. Tente de novo em instantes." };
  }
}
