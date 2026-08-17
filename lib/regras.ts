/**
 * Regras que a tela e o servidor precisam conhecer juntos.
 *
 * Vive fora dos arquivos "use server" porque lá só pode sair função assíncrona
 *, constante exportada quebra o build.
 */

/** Depois disso o cliente não cancela sozinho pelo link: só o painel. */
export const HORAS_LIMITE_CANCELAMENTO = 2;

/** Quem faltou tanto assim passa a pagar adiantado, sempre. */
export const FALTAS_ATE_PIX_OBRIGATORIO = 3;

/**
 * Quanto tempo se ganha a cada serviço extra no mesmo horário.
 *
 * Somar as durações inteiras mente: preparo, conversa, capa, limpeza e
 * acabamento acontecem uma vez só, não uma por serviço. Corte de 30 com barba
 * de 30 não leva uma hora — o Johny disse que leva 45, e é essa a conta.
 *
 * Existia um serviço "Máquina & tesoura + Barba" só para representar isso.
 * Era um item só, e a regra do clube é por serviço: o sistema não tinha como
 * saber que ali dentro havia um corte e uma barba, e acabou cobrando R$ 80 de
 * cinco assinantes que já pagam mensalidade. A regra aqui resolve o mesmo
 * problema sem precisar cadastrar combinação nenhuma.
 */
export const MINUTOS_A_MENOS_POR_EXTRA = 15;

/** Duração real de vários serviços feitos na mesma cadeira, em sequência. */
export function duracaoJunta(minutos: number[]) {
  if (minutos.length <= 1) return minutos[0] ?? 0;

  const soma = minutos.reduce((t, m) => t + m, 0);
  const desconto = (minutos.length - 1) * MINUTOS_A_MENOS_POR_EXTRA;

  // Nunca abaixo do serviço mais longo: três acabamentos de 15 minutos não
  // podem virar um agendamento de zero minuto em cima do próximo cliente.
  return Math.max(soma - desconto, Math.max(...minutos));
}
