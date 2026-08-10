import { emHora, emMinutos, PASSO_MIN } from "@/lib/agenda/disponibilidade";

/**
 * Onde começa "o resto do dia".
 *
 * Hoje, é o próximo bloco de 30 minutos: fechar a partir de agora deixaria uma
 * borda meio aberta, e arredondar para trás apagaria um horário que ainda pode
 * ser vendido. Em dia futuro, é a abertura, porque o dia inteiro está em jogo.
 *
 * Devolve null quando o expediente já passou, e aí não há o que fechar.
 */
export function comecoDoResto(
  janela: { abre: string; fecha: string } | null,
  dia: string,
  hoje: string,
  agora: string,
) {
  if (!janela) return null;
  if (dia < hoje) return null;
  if (dia > hoje) return janela.abre;

  const proximo = emHora(
    Math.ceil(emMinutos(agora) / PASSO_MIN) * PASSO_MIN,
  );
  const comeco = proximo > janela.abre ? proximo : janela.abre;

  return comeco < janela.fecha ? comeco : null;
}
