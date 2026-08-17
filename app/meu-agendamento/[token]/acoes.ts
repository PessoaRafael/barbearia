"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { casa } from "@/lib/dados/casa";
import { enfileirar } from "@/lib/notify/whatsapp";
import { cartaoLigado, sessaoDeCartao, sessaoFoiPaga } from "@/lib/payments/stripe";
import { HORAS_LIMITE_CANCELAMENTO } from "@/lib/regras";
import { clienteServico } from "@/lib/supabase/servidor";

export type Agendamento = {
  id: string;
  inicio: string;
  fim: string;
  status: string;
  valorCentavos: number;
  usouCredito: boolean;
  servico: string;
  duracaoMin: number;
  barbeiro: string;
  cliente: string;
  telefone: string;
  pix: { brcode: string; expiraEm: string | null; status: string } | null;
  podeCancelar: boolean;
};

export async function buscarAgendamento(
  token: string,
): Promise<Agendamento | null> {
  if (!/^[a-f0-9]{32}$/i.test(token)) return null;

  const supabase = clienteServico();
  const { data } = await supabase
    .from("appointments")
    .select(
      `id, inicio, fim, status, valor_centavos, usou_credito_clube,
       services!service_id(nome, duracao_min), barbers(apelido), clients(nome, telefone),
       payments(brcode, expira_em, status)`,
    )
    .eq("token_cliente", token)
    .maybeSingle();

  if (!data) return null;

  const um = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  const servico = um(data.services as never) as
    | { nome: string; duracao_min: number }
    | null;
  const barbeiro = um(data.barbers as never) as { apelido: string } | null;
  const cliente = um(data.clients as never) as
    | { nome: string; telefone: string }
    | null;
  const pagamento = um(data.payments as never) as
    | { brcode: string; expira_em: string | null; status: string }
    | null;

  const faltam = new Date(data.inicio).getTime() - Date.now();
  const vivo = ["confirmado", "pendente_pagamento"].includes(data.status);

  return {
    id: data.id,
    inicio: data.inicio,
    fim: data.fim,
    status: data.status,
    valorCentavos: data.valor_centavos,
    usouCredito: data.usou_credito_clube,
    servico: servico?.nome ?? "",
    duracaoMin: servico?.duracao_min ?? 0,
    barbeiro: barbeiro?.apelido ?? "",
    cliente: cliente?.nome ?? "",
    telefone: cliente?.telefone ?? "",
    pix: pagamento
      ? {
          brcode: pagamento.brcode,
          expiraEm: pagamento.expira_em,
          status: pagamento.status,
        }
      : null,
    podeCancelar:
      vivo && faltam > HORAS_LIMITE_CANCELAMENTO * 60 * 60 * 1000,
  };
}

const entrada = z.object({ token: z.string().regex(/^[a-f0-9]{32}$/i) });

export async function cancelar(
  _estado: { erro?: string } | null,
  formulario: FormData,
): Promise<{ erro?: string; ok?: boolean }> {
  const analise = entrada.safeParse({ token: formulario.get("token") });
  if (!analise.success) return { erro: "Link inválido." };

  const agendamento = await buscarAgendamento(analise.data.token);
  if (!agendamento) return { erro: "Não achei esse agendamento." };

  if (!agendamento.podeCancelar) {
    return {
      erro: `Falta menos de ${HORAS_LIMITE_CANCELAMENTO} horas. Fale com a barbearia para cancelar.`,
    };
  }

  const supabase = clienteServico();
  const { error } = await supabase.rpc("cancelar", {
    p_agendamento: agendamento.id,
    p_por: "cliente",
  });

  if (error) return { erro: "Não consegui cancelar agora. Tente de novo." };

  const { id } = await casa();
  await enfileirar({
    barbeariaId: id,
    destino: "cliente",
    template: "cancelamento",
    telefone: agendamento.telefone,
    dados: {
      cliente: agendamento.cliente.split(" ")[0],
      quando: new Date(agendamento.inicio).toLocaleString("pt-BR", {
        timeZone: "America/Fortaleza",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  });

  await avisarFila(id, agendamento.inicio);

  revalidatePath(`/meu-agendamento/${analise.data.token}`);
  // A área do clube lista os próximos horários da mesma pessoa: sem isso ela
  // continuaria mostrando o que acabou de ser desmarcado.
  revalidatePath("/clube");
  return { ok: true };
}

/**
 * Vagou uma cadeira: quem estava na fila daquele dia é avisado por ordem de
 * chegada. Marca como avisado para não mandar a mesma mensagem duas vezes.
 */
async function avisarFila(barbeariaId: string, inicio: string) {
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(inicio));

  const supabase = clienteServico();
  const { data: esperando } = await supabase
    .from("waitlist")
    .select("id, clients(nome, telefone)")
    .eq("barbershop_id", barbeariaId)
    .eq("data", dia)
    .is("avisado_em", null)
    .order("criado_em")
    .limit(5);

  for (const linha of esperando ?? []) {
    const cliente = Array.isArray(linha.clients) ? linha.clients[0] : linha.clients;
    if (!cliente) continue;

    await enfileirar({
      barbeariaId,
      destino: "cliente",
      template: "vaga_liberada",
      telefone: (cliente as { telefone: string }).telefone,
      dados: {
        cliente: (cliente as { nome: string }).nome.split(" ")[0],
        quando: dia.split("-").reverse().slice(0, 2).join("/"),
        link: "johnybarbearia.com.br/agendar",
      },
    });

    await supabase
      .from("waitlist")
      .update({ avisado_em: new Date().toISOString() })
      .eq("id", linha.id);
  }
}

/**
 * Página de cartão para este agendamento.
 *
 * Cria a cobrança na Stripe e guarda uma linha em `payments` com o id da
 * sessão no txid — é por ele que o webhook acha a cobrança quando o cliente
 * termina de pagar, e é isso que faz a agenda confirmar sozinha.
 *
 * O pix não é tocado: a linha dele continua lá, esperando. Quem confirmar
 * primeiro vence, e o webhook encerra a outra.
 */
export async function pagarComCartao(token: string) {
  if (!/^[a-f0-9]{32}$/i.test(token)) return { erro: "Link inválido." };
  if (!cartaoLigado()) return { erro: "Cartão não está disponível agora." };

  const site = process.env.SITE_URL?.replace(/\/$/, "");
  if (!site) return { erro: "Cartão não está disponível agora." };

  const supabase = clienteServico();

  const { data: ag } = await supabase
    .from("appointments")
    .select(
      "id, barbershop_id, status, valor_centavos, clients(nome, email), services!service_id(nome)",
    )
    .eq("token_cliente", token)
    .maybeSingle();

  if (!ag) return { erro: "Não achei esse agendamento." };
  if (ag.valor_centavos <= 0) return { erro: "Esse horário não tem valor a pagar." };
  if (!["pendente_pagamento", "confirmado"].includes(ag.status as string)) {
    return { erro: "Esse horário não está mais aberto para pagamento." };
  }

  const um = <T,>(v: T | T[] | null) => (Array.isArray(v) ? (v[0] ?? null) : v);
  const cliente = um(ag.clients as never) as { nome: string; email: string | null } | null;
  const servico = um(ag.services as never) as { nome: string } | null;

  // Já existe uma sessão de cartão aberta? Reaproveita, senão cada toque no
  // botão criaria uma cobrança nova e o cliente veria várias no extrato.
  const { data: aberta } = await supabase
    .from("payments")
    .select("txid")
    .eq("appointment_id", ag.id)
    .eq("metodo", "cartao")
    .eq("status", "aguardando")
    .maybeSingle();

  if (aberta?.txid) {
    try {
      if (!(await sessaoFoiPaga(aberta.txid))) {
        return { ok: true, url: `https://checkout.stripe.com/c/pay/${aberta.txid}` };
      }
    } catch {
      // Sessão sumiu ou expirou do lado deles: segue e cria outra.
    }
  }

  try {
    const sessao = await sessaoDeCartao({
      agendamentoId: ag.id as string,
      valorCentavos: ag.valor_centavos as number,
      descricao: servico?.nome ?? "Horário na barbearia",
      clienteNome: cliente?.nome ?? "cliente",
      clienteEmail: cliente?.email ?? null,
      siteUrl: site,
      tokenCliente: token,
    });

    await supabase.from("payments").insert({
      barbershop_id: ag.barbershop_id,
      appointment_id: ag.id,
      metodo: "cartao",
      valor_centavos: ag.valor_centavos,
      status: "aguardando",
      txid: sessao.id,
    });

    return { ok: true, url: sessao.url };
  } catch (erro) {
    console.error("stripe: nao consegui criar a sessao:", (erro as Error).message);
    // Falhar aqui não pode custar o horário: o pix continua na tela.
    return { erro: "Não consegui abrir o cartão agora. Use o pix acima." };
  }
}
