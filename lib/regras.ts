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
