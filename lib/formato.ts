/** Formatação de números e horas. Sempre renderizados com a classe .num */

/** 8470 -> "8.470". Sem depender de locale, para o servidor e o cliente baterem. */
export function numero(valor: number) {
  const [inteiro, decimal] = valor.toString().split(".");
  const comPonto = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal ? `${comPonto},${decimal}` : comPonto;
}

export function moeda(valor: number) {
  if (Number.isInteger(valor)) return `R$ ${numero(valor)}`;
  return `R$ ${numero(Number(valor.toFixed(2)))}`;
}

export function minutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function hora(minutosDoDia: number) {
  const h = Math.floor(minutosDoDia / 60);
  const m = minutosDoDia % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function duracaoCurta(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h}h${String(resto).padStart(2, "0")}` : `${h}h`;
}

export function fimDe(inicio: string, duracaoMin: number) {
  return hora(minutos(inicio) + duracaoMin);
}
