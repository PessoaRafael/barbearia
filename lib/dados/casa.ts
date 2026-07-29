import "server-only";

import { cache } from "react";

import { clienteServico } from "@/lib/supabase/servidor";

export const SLUG = process.env.NEXT_PUBLIC_BARBEARIA_SLUG ?? "johny-barbearia";

export type Casa = {
  id: string;
  nome: string;
  slug: string;
  cidade: string;
  endereco: string | null;
  telefone: string | null;
  pix_key: string | null;
  pix_titular: string | null;
  pagamento_modalidade: "opcional" | "obrigatorio";
  reserva_minutos: number;
  lembrete_horas: number;
  clube_ativo: boolean;
  clube_preco_centavos: number;
  clube_cortes_mes: number;
};

/** Uma leitura por requisição, por mais telas que peçam. */
export const casa = cache(async (): Promise<Casa> => {
  const supabase = clienteServico();
  const { data, error } = await supabase
    .from("barbershops")
    .select("*")
    .eq("slug", SLUG)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Barbearia "${SLUG}" não encontrada. Rodou as migrations e o seed?`,
    );
  }
  return data as Casa;
});

export const servicosAtivos = cache(async () => {
  const supabase = clienteServico();
  const { id } = await casa();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("barbershop_id", id)
    .eq("ativo", true)
    .order("ordem");
  return data ?? [];
});

export const barbeirosAtivos = cache(async () => {
  const supabase = clienteServico();
  const { id } = await casa();
  const { data } = await supabase
    .from("barbers")
    .select("id, nome, apelido, especialidade, foto_url")
    .eq("barbershop_id", id)
    .eq("ativo", true)
    .order("ordem");
  return data ?? [];
});
