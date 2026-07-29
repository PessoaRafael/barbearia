/**
 * BR Code (pix copia e cola) montado aqui mesmo, no padrão EMV do Banco
 * Central. Sem serviço pago: são campos no formato tamanho-valor mais um
 * CRC16-CCITT no fim.
 *
 * A chave é o celular do Johny. Cada agendamento gera um txid próprio e leva o
 * valor exato, para ele bater o extrato sem adivinhar quem pagou.
 */

type Campo = { id: string; valor: string };

const emv = (id: string, valor: string) =>
  `${id}${String(valor.length).padStart(2, "0")}${valor}`;

const montar = (campos: Campo[]) =>
  campos.map((c) => emv(c.id, c.valor)).join("");

/** CRC16-CCITT (FALSE): polinômio 0x1021, inicial 0xFFFF. */
export function crc16(dado: string) {
  let crc = 0xffff;

  for (let i = 0; i < dado.length; i++) {
    crc ^= dado.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Acentos combinantes que sobram depois do normalize("NFD"). */
const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");

/** Tira acento e o que o padrão não aceita em nome e cidade. */
function limpar(texto: string, limite: number) {
  return texto
    .normalize("NFD")
    .replace(ACENTOS, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, limite);
}

/** Só letras e números, como o campo 05 exige. */
export function limparTxid(bruto: string) {
  return bruto.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
}

/** Celular vira +5584999835180; outras chaves passam como estão. */
export function normalizarChavePix(chave: string) {
  const digitos = chave.replace(/\D/g, "");
  if (/^\d{10,11}$/.test(digitos)) return `+55${digitos}`;
  if (/^55\d{10,11}$/.test(digitos)) return `+${digitos}`;
  return chave.trim();
}

/** (84) 99983-5180 — só para a tela; copiar leva os dígitos crus. */
export function formatarTelefone(chave: string) {
  const d = chave.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return chave;
}

export type DadosPix = {
  chave: string;
  titular: string;
  cidade: string;
  valorCentavos: number;
  txid: string;
};

export function gerarBrCode({
  chave,
  titular,
  cidade,
  valorCentavos,
  txid,
}: DadosPix) {
  const conta = montar([
    { id: "00", valor: "br.gov.bcb.pix" },
    { id: "01", valor: normalizarChavePix(chave) },
  ]);

  const extra = montar([{ id: "05", valor: limparTxid(txid) }]);

  const corpo =
    montar([
      { id: "00", valor: "01" },
      // 12 = uso único: cada agendamento tem o seu.
      { id: "01", valor: "12" },
      { id: "26", valor: conta },
      { id: "52", valor: "0000" },
      { id: "53", valor: "986" },
      { id: "54", valor: (valorCentavos / 100).toFixed(2) },
      { id: "58", valor: "BR" },
      { id: "59", valor: limpar(titular, 25) },
      { id: "60", valor: limpar(cidade, 15) },
      { id: "62", valor: extra },
    ]) + "6304";

  return corpo + crc16(corpo);
}
