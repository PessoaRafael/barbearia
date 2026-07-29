import "server-only";

import { clienteServico } from "@/lib/supabase/servidor";
import type { Template } from "./textos";

export { linkWhatsapp, textoDe, type Template } from "./textos";

/**
 * NotificaÃ§Ã£o por WhatsApp sem API paga.
 *
 * Tudo entra na fila em `notifications`. Sem provedor configurado, o painel
 * mostra a fila com um link wa.me e o texto pronto: o Johny dispara em um
 * clique. Quando entrar a API oficial, sÃ³ o `enviar` daqui muda.
 */

type Dados = Record<string, string>;
export async function enfileirar(entrada: {
  barbeariaId: string;
  destino: "cliente" | "barbeiro" | "owner";
  template: Template;
  dados: Dados;
  telefone?: string | null;
  agendadaPara?: Date;
}) {
  const supabase = clienteServico();

  await supabase.from("notifications").insert({
    barbershop_id: entrada.barbeariaId,
    destino: entrada.destino,
    canal: "whatsapp",
    template: entrada.template,
    payload: entrada.dados,
    telefone: entrada.telefone ?? null,
    agendada_para: (entrada.agendadaPara ?? new Date()).toISOString(),
  });
}

/**
 * Marca como enviada. Com API oficial, Ã© aqui que a chamada entra; sem ela,
 * quem marca Ã© o Johny depois de disparar o wa.me.
 */
export async function marcarEnviada(id: string) {
  const supabase = clienteServico();
  await supabase
    .from("notifications")
    .update({ status: "enviada", enviada_em: new Date().toISOString() })
    .eq("id", id);
}
