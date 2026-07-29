import "server-only";

import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Notificação por WhatsApp sem API paga.
 *
 * Tudo entra na fila em `notifications`. Sem provedor configurado, o painel
 * mostra a fila com um link wa.me e o texto pronto: o Johny dispara em um
 * clique. Quando entrar a API oficial, só o `enviar` daqui muda.
 */

export type Template =
  | "agendamento_criado"
  | "pix_confirmado"
  | "pix_expirado"
  | "lembrete"
  | "cancelamento"
  | "mensalidade_vencendo"
  | "mensalidade_vencida"
  | "vaga_liberada";

type Dados = Record<string, string>;

const TEXTOS: Record<Template, (d: Dados) => string> = {
  agendamento_criado: (d) =>
    `Fala ${d.cliente}! Seu horário na Johny Barbearia está marcado: ${d.servico} com ${d.barbeiro}, ${d.quando}. Qualquer coisa é só chamar aqui.`,

  pix_confirmado: (d) =>
    `${d.cliente}, o pix caiu e seu horário está confirmado: ${d.servico} com ${d.barbeiro}, ${d.quando}. Te espero na cadeira.`,

  pix_expirado: (d) =>
    `${d.cliente}, o prazo do pix passou e o horário de ${d.quando} voltou para a agenda. Se ainda quiser, é só marcar de novo.`,

  lembrete: (d) =>
    `${d.cliente}, passando para lembrar: ${d.servico} com ${d.barbeiro} hoje ${d.quando}. Se não puder vir, avisa que eu libero a cadeira.`,

  cancelamento: (d) =>
    `${d.cliente}, seu horário de ${d.quando} foi cancelado. Quando quiser remarcar, é só entrar no link.`,

  mensalidade_vencendo: (d) =>
    `${d.cliente}, sua mensalidade do Clube Johny vence ${d.quando}. São ${d.valor} no pix ${d.pix}.`,

  mensalidade_vencida: (d) =>
    `${d.cliente}, a mensalidade do Clube Johny venceu ${d.quando}. São ${d.valor} no pix ${d.pix} para os cortes continuarem valendo.`,

  vaga_liberada: (d) =>
    `${d.cliente}, vagou um horário ${d.quando} na Johny Barbearia. Se ainda quiser, corre que é por ordem de chegada: ${d.link}`,
};

export function textoDe(template: Template, dados: Dados) {
  return TEXTOS[template](dados);
}

/** Link que abre o WhatsApp com a mensagem já escrita. */
export function linkWhatsapp(telefone: string, texto: string) {
  const digitos = telefone.replace(/\D/g, "");
  const comPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`;
}

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
 * Marca como enviada. Com API oficial, é aqui que a chamada entra; sem ela,
 * quem marca é o Johny depois de disparar o wa.me.
 */
export async function marcarEnviada(id: string) {
  const supabase = clienteServico();
  await supabase
    .from("notifications")
    .update({ status: "enviada", enviada_em: new Date().toISOString() })
    .eq("id", id);
}
