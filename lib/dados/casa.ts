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

export type PlanoClube = {
  id: string;
  slug: string;
  nome: string;
  preco_centavos: number;
  cobre_categorias: string[];
  dias_semana: number[];
  duracao_dias: number;
};

/** Os planos do clube, na ordem em que o Johny quer que apareçam. */
export const planosDoClube = cache(async (): Promise<PlanoClube[]> => {
  const supabase = clienteServico();
  const { id } = await casa();
  const { data } = await supabase
    .from("club_plans")
    .select(
      "id, slug, nome, preco_centavos, cobre_categorias, dias_semana, duracao_dias",
    )
    .eq("barbershop_id", id)
    .eq("ativo", true)
    .order("ordem");

  return (data ?? []) as PlanoClube[];
});

const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/**
 * "segunda a quinta" quando os dias são seguidos, senão a lista mesmo.
 * O caso seguido é o único que existe hoje, mas o Johny pode fatiar depois.
 */
export function diasEmTexto(dias: number[]) {
  if (!dias.length) return "";
  const ordenados = [...dias].sort((a, b) => a - b);
  const seguidos = ordenados.every((d, i) => i === 0 || d === ordenados[i - 1] + 1);

  if (ordenados.length === 1) return SEMANA[ordenados[0]];
  if (seguidos) {
    return `${SEMANA[ordenados[0]]} a ${SEMANA[ordenados[ordenados.length - 1]]}`;
  }
  return ordenados.map((d) => SEMANA[d]).join(", ");
}

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
