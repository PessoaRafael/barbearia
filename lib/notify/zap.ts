/**
 * Abrir a conversa no WhatsApp Business, e não no pessoal.
 *
 * O Johny atende pelo Business. Mas `wa.me` é um link comum: quem decide qual
 * aplicativo abre é o celular, e com os dois instalados ele abre o pessoal —
 * então toda mensagem de cobrança saía do número errado.
 *
 * No Android dá para endereçar o aplicativo pelo nome do pacote. Se o Business
 * não estiver instalado, o próprio Chrome cai no `wa.me`, que é o que já
 * acontecia antes. Em iPhone e no computador não existe esse endereçamento, e
 * aí segue o caminho de sempre.
 */

const BUSINESS = "com.whatsapp.w4b";

/** Só dígitos, com o 55 na frente, que é o que o WhatsApp espera. */
export function numeroZap(telefone: string) {
  const d = (telefone ?? "").replace(/\D/g, "");
  return d.startsWith("55") ? d : `55${d}`;
}

export function linkWa(telefone: string, texto: string) {
  return `https://wa.me/${numeroZap(telefone)}?text=${encodeURIComponent(texto)}`;
}

/**
 * O endereço que força o Business no Android.
 *
 * `S.browser_fallback_url` é o que impede a tela em branco quando o Business
 * não está instalado: o Chrome abre o wa.me no lugar.
 */
function linkBusiness(telefone: string, texto: string) {
  const alvo = `send?phone=${numeroZap(telefone)}&text=${encodeURIComponent(texto)}`;
  const volta = encodeURIComponent(linkWa(telefone, texto));

  return `intent://${alvo}#Intent;scheme=whatsapp;package=${BUSINESS};S.browser_fallback_url=${volta};end`;
}

const ehAndroid = () =>
  typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

/**
 * Usar no `onClick` do link.
 *
 * O `href` continua sendo o wa.me — assim o link segue válido para copiar,
 * abrir em outra aba ou usar no computador. Aqui só desviamos quando dá para
 * fazer melhor.
 */
export function abrirZap(
  evento: { preventDefault: () => void },
  telefone: string,
  texto: string,
) {
  if (!ehAndroid()) return;

  evento.preventDefault();
  window.location.href = linkBusiness(telefone, texto);
}
