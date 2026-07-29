"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { casa } from "@/lib/dados/casa";
import { enfileirar } from "@/lib/notify/whatsapp";
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
       services(nome, duracao_min), barbers(apelido), clients(nome, telefone),
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

  revalidatePath(`/meu-agendamento/${analise.data.token}`);
  return { ok: true };
}
