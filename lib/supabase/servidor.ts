import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Só o servidor fala com o banco. O navegador nunca recebe uma chave que
 * consulte tabela.
 *
 * O projeto assina JWT com chave assimétrica e a Supabase não entrega a chave
 * privada, então o servidor não tem como forjar um token que o PostgREST leia.
 * Por isso a identidade não viaja em claim: ela entra como argumento nas
 * funções de supabase/migrations/0004_acesso.sql, que derivam o barbeiro da
 * própria chave de acesso.
 *
 * O RLS continua ligado e sem policy nenhuma: se a publishable key vazar,
 * toda tabela responde vazio.
 */

function url() {
  const valor = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!valor) throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurado.");
  return valor;
}

let cache: SupabaseClient | null = null;

export function clienteServico(): SupabaseClient {
  if (cache) return cache;

  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurado — é a secret key do projeto.",
    );
  }

  cache = createClient(url(), chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cache;
}
