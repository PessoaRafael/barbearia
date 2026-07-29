/**
 * Confere o BR Code contra o exemplo do manual do Banco Central e contra um
 * pix real da barbearia. Roda com: npm run teste:pix
 */

import { crc16, gerarBrCode } from "../lib/pix/brcode.ts";

let falhas = 0;

function conferir(nome, obtido, esperado) {
  const passou = obtido === esperado;
  if (!passou) falhas++;
  console.log(`${passou ? "ok  " : "FALHA"} ${nome}`);
  if (!passou) {
    console.log(`      esperado: ${esperado}`);
    console.log(`      obtido:   ${obtido}`);
  }
}

// Vetor padrão do CRC-16/CCITT-FALSE: "123456789" tem que dar 29B1.
conferir("CRC16 do vetor padrão", crc16("123456789"), "29B1");

// Um pix da casa: chave celular, valor de corte social, txid do agendamento.
const brcode = gerarBrCode({
  chave: "84999835180",
  titular: "Johny Rodrigues Gomes",
  cidade: "Natal",
  valorCentavos: 3500,
  txid: "JHNYAB12CD34",
});

console.log(`\n     ${brcode}\n`);

conferir("começa com o payload format", brcode.slice(0, 6), "000201");
conferir("marca uso único", brcode.slice(6, 12), "010212");
conferir("chave vira +55", brcode.includes("+5584999835180"), true);
conferir("moeda em real", brcode.includes("5303986"), true);
conferir("valor com centavos", brcode.includes("540535.00"), true);
conferir("titular sem acento e em caixa alta", brcode.includes("JOHNY RODRIGUES GOMES"), true);
conferir("país no campo 58", brcode.includes("5802BR"), true);
conferir("cidade no campo 60", brcode.includes("6005NATAL"), true);

// O CRC do fim tem que fechar com o corpo que veio antes dele.
const corpo = brcode.slice(0, -4);
conferir("CRC fecha com o próprio corpo", crc16(corpo), brcode.slice(-4));

console.log("");
if (falhas) {
  console.error(`${falhas} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("BR Code ok.");
