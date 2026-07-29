import "server-only";

import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Chave de acesso no formato JHNY-XXXX-XXXX.
 *
 * O Johny lê essa chave em voz alta no WhatsApp, então o alfabeto não tem
 * O, I, 0 nem 1 — os quatro caracteres que fazem alguém digitar errado.
 *
 * No banco fica só o hash. Formato: scrypt$N$r$p$salt$hash, tudo em hex.
 * Se mudar aqui, mude também em scripts/token-owner.mjs.
 */

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PREFIXO = "JHNY";
const N = 16384;
const R = 8;
const P = 1;
const TAMANHO = 32;

function bloco(tamanho: number) {
  let saida = "";
  for (let i = 0; i < tamanho; i++) {
    saida += ALFABETO[randomInt(ALFABETO.length)];
  }
  return saida;
}

export function gerarChave() {
  return `${PREFIXO}-${bloco(4)}-${bloco(4)}`;
}

/** Normaliza o que o barbeiro digitou: maiúsculas, sem espaço, com hífens. */
export function normalizarChave(bruta: string) {
  const limpa = bruta
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^JHNY/, "");

  const corpo = limpa.slice(0, 8);
  if (corpo.length <= 4) return `${PREFIXO}-${corpo}`;
  return `${PREFIXO}-${corpo.slice(0, 4)}-${corpo.slice(4)}`;
}

export function chaveValida(chave: string) {
  return /^JHNY-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(chave);
}

/** Os 4 primeiros dígitos, para a lista do painel mostrar sem revelar. */
export function prefixoDe(chave: string) {
  return chave.slice(5, 9);
}

export function hashChave(chave: string) {
  const sal = randomBytes(16);
  const derivada = scryptSync(chave, sal, TAMANHO, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString("hex")}$${derivada.toString("hex")}`;
}

export function conferirChave(chave: string, guardado: string) {
  try {
    const [algoritmo, n, r, p, salHex, hashHex] = guardado.split("$");
    if (algoritmo !== "scrypt") return false;

    const derivada = scryptSync(chave, Buffer.from(salHex, "hex"), hashHex.length / 2, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });

    const guardada = Buffer.from(hashHex, "hex");
    return (
      derivada.length === guardada.length && timingSafeEqual(derivada, guardada)
    );
  } catch {
    return false;
  }
}
