"use server";

import { revalidatePath } from "next/cache";

import { lerSessao } from "@/lib/auth/sessao";
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
