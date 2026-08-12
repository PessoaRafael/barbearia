"use server";

import { z } from "zod";

import { casa } from "@/lib/dados/casa";
import { moedaCentavos } from "@/lib/formato";
import { enfileirar } from "@/lib/notify/whatsapp";
import { linkDoValor } from "@/lib/payments/links";
import { provedorAtual } from "@/lib/payments/provider";
import { svgDoBrcode } from "@/lib/pix/qr";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Entrada no clube pela landing.
 *
 * Gera o pix da mensalidade na hora, mas NÃO ativa a assinatura: quem confirma
 * que o dinheiro caiu continua sendo o Johny, no painel, igual ao pix de
 * agendamento. O cliente entra na fila de cobrança com o pedido registrado.
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

  const telefone = analise.data.telefone.replace(/\D/g, "");
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
