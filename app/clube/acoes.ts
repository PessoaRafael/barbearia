"use server";

import { revalidatePath } from "next/cache";

import { lerSessao } from "@/lib/auth/sessao";
import { enfileirar } from "@/lib/notify/whatsapp";
import {
  cancelarNoFimDoCiclo,
  portalDoCliente,
  voltarAtrasNoCancelamento,
} from "@/lib/payments/stripe";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * O assinante guardando a própria data de nascimento.
 *
 * Quem manda para o banco é a chave da sessão, não um id vindo da tela: a
 * função do Postgres resolve de qual cliente é a área aberta. Sem isso, bastaria
 * trocar um campo escondido para escrever no cadastro de outra pessoa.
 */
export async function salvarNascimento(
  _estado: { ok?: boolean; erro?: string; data?: string | null } | null,
  formulario: FormData,
) {
  const sessao = await lerSessao();
  if (!sessao || sessao.papel !== "client") {
    return { erro: "Entre de novo pelo seu link." };
  }

  const bruto = String(formulario.get("nascimento") ?? "").trim();
  const data = bruto || null;

  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { erro: "Confira a data." };
  }

  const { error } = await clienteServico().rpc("salvar_nascimento", {
    p_chave: sessao.chaveId,
    p_data: data,
  });

  if (error) {
    // A própria função recusa data no futuro e ano irreal.
    return {
      erro: error.message.includes("data_invalida")
        ? "Essa data não parece certa."
        : "Não consegui salvar agora.",
    };
  }

  revalidatePath("/clube");
  return { ok: true, data };
}

/**
 * O assinante cancelando a renovação, na nossa tela.
 *
 * Corta no fim do ciclo, nunca na hora: ele pagou trinta dias e tirar o acesso
 * no dia do clique seria ficar com dinheiro dele. Até lá continua entrando
 * normalmente — e se mudar de ideia, é só voltar atrás.
 *
 * Só mexe na assinatura de quem está pedindo: o id vem do banco pela chave da
 * sessão, nunca da tela.
 */
export async function cancelarRenovacao() {
  const sessao = await lerSessao();
  if (!sessao || sessao.papel !== "client" || !sessao.clienteId) {
    return { erro: "Entre de novo pelo seu link." };
  }

  const supabase = clienteServico();
  const { data: assin } = await supabase
    .from("subscriptions")
    .select("id, stripe_subscription_id, ciclo_fim")
    .eq("client_id", sessao.clienteId)
    .neq("status", "cancelada")
    .maybeSingle();

  if (!assin?.stripe_subscription_id) {
    // Assinatura no pix não tem o que desligar: ela simplesmente vence.
    return {
      erro: "Sua assinatura não é automática. Fale com o Johny para encerrar.",
    };
  }

  try {
    await cancelarNoFimDoCiclo(assin.stripe_subscription_id);
  } catch (erro) {
    console.error("stripe: cancelamento falhou:", (erro as Error).message);
    return { erro: "Não consegui cancelar agora. Tente daqui a pouco." };
  }

  await supabase
    .from("subscriptions")
    .update({ cancela_no_fim: true })
    .eq("id", assin.id);

  /**
   * O Johny fica sabendo.
   *
   * Não para impedir — a decisão é do cliente. Mas cliente que cancela sem
   * ninguém perceber é cliente perdido em silêncio, e essa é a informação mais
   * útil que existe para ele.
   */
  await enfileirar({
    barbeariaId: sessao.barbeariaId,
    destino: "owner",
    template: "cancelamento",
    telefone: sessao.casa.telefone,
    dados: {
      cliente: sessao.nome,
      quando: `pediu para não renovar o clube. Vale até ${assin.ciclo_fim}`,
    },
  }).catch(() => {
    // Avisar é bom, mas não pode impedir o cancelamento de valer.
  });

  revalidatePath("/clube");
  return { ok: true, ate: assin.ciclo_fim as string };
}

/** Desistiu de cancelar. */
export async function voltarAtras() {
  const sessao = await lerSessao();
  if (!sessao || sessao.papel !== "client" || !sessao.clienteId) {
    return { erro: "Entre de novo pelo seu link." };
  }

  const supabase = clienteServico();
  const { data: assin } = await supabase
    .from("subscriptions")
    .select("id, stripe_subscription_id")
    .eq("client_id", sessao.clienteId)
    .neq("status", "cancelada")
    .maybeSingle();

  if (!assin?.stripe_subscription_id) return { erro: "Nada para desfazer." };

  try {
    await voltarAtrasNoCancelamento(assin.stripe_subscription_id);
  } catch {
    return { erro: "Não consegui agora. Tente daqui a pouco." };
  }

  await supabase
    .from("subscriptions")
    .update({ cancela_no_fim: false })
    .eq("id", assin.id);

  revalidatePath("/clube");
  return { ok: true };
}

/** Leva ele à página da Stripe para trocar o cartão. */
export async function paginaDoCartao() {
  const sessao = await lerSessao();
  if (!sessao || sessao.papel !== "client" || !sessao.clienteId) {
    return { erro: "Entre de novo pelo seu link." };
  }

  const site = process.env.SITE_URL?.replace(/\/$/, "");
  if (!site) return { erro: "Indisponível agora." };

  const { data: assin } = await clienteServico()
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("client_id", sessao.clienteId)
    .neq("status", "cancelada")
    .maybeSingle();

  if (!assin?.stripe_customer_id) return { erro: "Você não tem cartão salvo." };

  try {
    const url = await portalDoCliente(
      assin.stripe_customer_id,
      `${site}/clube`,
    );
    return { ok: true, url };
  } catch (erro) {
    console.error("stripe portal:", (erro as Error).message);
    return { erro: "Não consegui abrir agora." };
  }
}
