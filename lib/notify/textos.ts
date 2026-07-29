/**
 * Textos das mensagens e montagem do link wa.me.
 *
 * Fica separado de whatsapp.ts, que é "server-only" por causa do banco: a tela
 * do painel precisa escrever a mensagem no navegador para montar o link de
 * disparo, e não pode arrastar o cliente do Supabase junto.
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
    `${d.cliente}, o pix caiu e seu horário está confirmado: ${d.quando}. Te espero na cadeira.`,

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
  const monta = TEXTOS[template];
  return monta ? monta(dados) : "";
}

/** Link que abre o WhatsApp com a mensagem já escrita. */
export function linkWhatsapp(telefone: string, texto: string) {
  const digitos = telefone.replace(/\D/g, "");
  const comPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`;
}
