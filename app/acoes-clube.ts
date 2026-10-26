"use server";

import { z } from "zod";

import { linkDaMensalidade } from "@/lib/clube/link";
import { casa } from "@/lib/dados/casa";
import { moedaCentavos, telefoneChave } from "@/lib/formato";
import { enfileirar } from "@/lib/notify/whatsapp";
import {
  cobrarMensalidadeNaInfinitepay,
  infinitepayLigado,
} from "@/lib/payments/infinitepay";
import { linkDoValor } from "@/lib/payments/links";
import { provedorAtual } from "@/lib/payments/provider";
import { svgDoBrcode } from "@/lib/pix/qr";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Entrada no clube pela landing.
 *
 * Com a InfinitePay ligada, manda para a página dela e o clube liga sozinho
 * quando o pagamento passa. Sem ela, gera o pix da mensalidade na hora, mas
 * NÃO ativa a assinatura: quem confirma que o dinheiro caiu é o Johny, no
 * painel, igual ao pix de agendamento.
 */

const entrada = z.object({
  nome: z.string().trim().min(2).max(80),
  telefone: z.string().trim().min(10).max(20),
  planoId: z.string().uuid(),
});

export type PedidoClube =
  | {
      ok: true;
      brcode: string;
      qrSvg: string | null;
      chave: string;
      titular: string;
      valor: string;
      plano: string;
      jaAssinante: boolean;
      /** Link de cartão do PagBank para a mensalidade, se houver. */
      linkCartao: string | null;
    }
  /** A página da InfinitePay, para onde a tela manda o cliente. */
  | { ok: true; pagamentoUrl: string }
  | { ok: false; erro: string };

export async function pedirClube(
  dados: z.input<typeof entrada>,
): Promise<PedidoClube> {
  const analise = entrada.safeParse(dados);
  if (!analise.success) return { ok: false, erro: "Confira nome e WhatsApp." };

  const barbearia = await casa();
  if (!barbearia.clube_ativo || !barbearia.pix_key) {
    return { ok: false, erro: "O clube está fechado no momento." };
  }

  const telefone = telefoneChave(analise.data.telefone);
  const supabase = clienteServico();

  // O valor sai do plano no banco, nunca do que a tela mandou: preço vindo do
  // navegador é preço que o cliente escolhe.
  const { data: plano } = await supabase
    .from("club_plans")
    .select("id, nome, preco_centavos")
    .eq("id", analise.data.planoId)
    .eq("barbershop_id", barbearia.id)
    .eq("ativo", true)
    .maybeSingle();

  if (!plano) return { ok: false, erro: "Esse plano não está disponível." };

  const { data: cliente } = await supabase
    .from("clients")
    .upsert(
      {
        barbershop_id: barbearia.id,
        nome: analise.data.nome,
        telefone,
      },
      { onConflict: "barbershop_id,telefone" },
    )
    .select("id")
    .single();

  if (!cliente) return { ok: false, erro: "Não consegui registrar agora." };

  const { data: assinatura } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("client_id", cliente.id)
    .eq("status", "ativa")
    .maybeSingle();

  /**
   * O pix de sempre nem nasce com a InfinitePay ligada: com os dois na tela,
   * o cliente podia pagar o QR antigo e voltar a esperar o Johny conferir.
   *
   * Quem já é do clube e paga aqui adianta o próximo mês, que começa onde o
   * atual termina. Falhou a InfinitePay, segue para o pix de sempre abaixo.
   */
  if (infinitepayLigado()) {
    try {
      const pagamentoUrl = await cobrarMensalidadeNaInfinitepay({
        barbeariaId: barbearia.id,
        clienteId: cliente.id,
        planoId: plano.id,
        valorCentavos: plano.preco_centavos,
        descricao: `Mensalidade ${plano.nome}`,
        clienteNome: analise.data.nome,
        volta: linkDaMensalidade(cliente.id),
      });
      return { ok: true, pagamentoUrl };
    } catch (erro) {
      console.error("infinitepay clube: link nao criado, vai no pix:", (erro as Error).message);
    }
  }

  const cobranca = await provedorAtual().criarCobranca({
    barbeariaId: barbearia.id,
    // Sem agendamento, o txid sai do cliente: é o que deixa o Johny saber de
    // quem é o pix quando ele olhar o extrato.
    agendamentoId: cliente.id,
    valorCentavos: plano.preco_centavos,
    chavePix: barbearia.pix_key,
    titular: barbearia.pix_titular ?? barbearia.nome,
    cidade: barbearia.cidade,
    minutos: 60 * 24,
    cliente: { nome: analise.data.nome, telefone },
  });

  if (!assinatura) {
    await enfileirar({
      barbeariaId: barbearia.id,
      destino: "owner",
      template: "mensalidade_vencendo",
      telefone,
      dados: {
        cliente: analise.data.nome,
        quando: `quer entrar no clube: ${plano.nome}`,
        valor: moedaCentavos(plano.preco_centavos),
        pix: barbearia.pix_key,
      },
    });
  }

  return {
    ok: true,
    brcode: cobranca.brcode,
    qrSvg: await svgDoBrcode(cobranca.brcode).catch(() => null),
    chave: barbearia.pix_key,
    titular: barbearia.pix_titular ?? barbearia.nome,
    valor: moedaCentavos(plano.preco_centavos),
    plano: plano.nome,
    jaAssinante: Boolean(assinatura),
    linkCartao: await linkDoValor(barbearia.id, plano.preco_centavos),
  };
}
