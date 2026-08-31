/** Formatação de números e horas. Sempre renderizados com a classe .num */

/** 8470 -> "8.470". Sem depender de locale, para o servidor e o cliente baterem. */
export function numero(valor: number) {
  const [inteiro, decimal] = valor.toString().split(".");
  const comPonto = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal ? `${comPonto},${decimal}` : comPonto;
}

/** O banco guarda centavos; a tela mostra reais. */
export function moedaCentavos(centavos: number) {
  return moeda(centavos / 100);
}

/** (84) 99983-5180 */
/**
 * O telefone como identidade do cliente.
 *
 * Não existe cadastro nem senha: o telefone é quem diz quem é a pessoa. Então
 * dois jeitos de escrever o mesmo número viram duas pessoas — e foi o que
 * aconteceu com o Denilson, que remarcou digitando +55 e o sistema cobrou de
 * novo por não reconhecê-lo.
 *
 * Para um assinante isso é pior: ele digita o código do país, deixa de ser
 * reconhecido e paga por um corte que a mensalidade dele já cobre.
 *
 * Tira o 55 só quando sobra um número brasileiro plausível. Número de 12 ou 13
 * dígitos que não comece com 55 fica como está: melhor guardar estranho do que
 * mutilar o telefone de alguém.
 */
export function telefoneChave(bruto: string) {
  const digitos = (bruto ?? "").replace(/\D/g, "");

  if (digitos.length >= 12 && digitos.startsWith("55")) {
    const sem = digitos.slice(2);
    if (sem.length === 10 || sem.length === 11) return sem;
  }

  return digitos;
}

export function telefoneBonito(bruto: string) {
  const d = bruto.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto;
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
