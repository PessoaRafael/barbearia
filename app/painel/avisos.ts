"use server";

import { exigirEquipe } from "@/lib/auth/sessao";
import { clienteServico } from "@/lib/supabase/servidor";

/**
 * O aparelho pedindo para receber avisos.
 *
 * A inscrição pende da chave de acesso, não da pessoa: revogou a chave do
 * barbeiro, ele para de receber no mesmo instante. Sem isso, quem saísse da
 * equipe continuaria vendo a agenda da casa no celular.
 */
export async function inscreverAparelho(assinatura: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  const sessao = await exigirEquipe();

  if (!assinatura?.endpoint || !assinatura.p256dh || !assinatura.auth) {
    return { erro: "Inscrição incompleta." };
  }

  const { error } = await clienteServico()
    .from("push_inscricoes")
    .upsert(
      {
        barbershop_id: sessao.barbeariaId,
        chave_id: sessao.chaveId,
        barber_id: sessao.barbeiroId,
        endpoint: assinatura.endpoint,
        p256dh: assinatura.p256dh,
        auth: assinatura.auth,
        falhas: 0,
      },
      // Mesmo aparelho reinscrito devolve o mesmo endereço: atualiza em vez
      // de criar outra linha e mandar o aviso duas vezes.
      { onConflict: "endpoint" },
    );

  if (error) return { erro: "Não consegui ligar os avisos." };
  return { ok: true };
}

/** Desligou os avisos naquele aparelho. */
export async function desinscreverAparelho(endpoint: string) {
  await exigirEquipe();

  await clienteServico()
    .from("push_inscricoes")
    .delete()
    .eq("endpoint", endpoint);

  return { ok: true };
}

/** Um aviso de teste, para ele ver como chega antes de confiar. */
export async function avisoDeTeste() {
  const sessao = await exigirEquipe();
  const { avisarNoCelular } = await import("@/lib/notify/push");

  const r = await avisarNoCelular({
    barbeariaId: sessao.barbeariaId,
    barbeiroId: sessao.barbeiroId,
    aviso: {
      titulo: "Deu certo",
      corpo: "É assim que os avisos vão chegar quando alguém marcar.",
      grupo: "teste",
    },
  });

  return { ok: true, enviados: r.enviados };
}
