/**
 * Desenho de QR code de placeholder: determinístico a partir da chave, para o
 * servidor e o cliente renderizarem exatamente a mesma matriz.
 */
const LADO = 25;

function embaralhar(semente: string) {
  let estado = 2166136261;
  for (let i = 0; i < semente.length; i++) {
    estado ^= semente.charCodeAt(i);
    estado = Math.imul(estado, 16777619);
  }
  return () => {
    estado ^= estado << 13;
    estado ^= estado >>> 17;
    estado ^= estado << 5;
    return (estado >>> 0) / 4294967296;
  };
}

function dentroDoMarcador(linha: number, coluna: number) {
  const cantos = [
    [0, 0],
    [0, LADO - 7],
    [LADO - 7, 0],
  ];
  return cantos.some(
    ([l, c]) => linha >= l && linha < l + 7 && coluna >= c && coluna < c + 7,
  );
}

function marcadorAceso(linha: number, coluna: number) {
  const cantos = [
    [0, 0],
    [0, LADO - 7],
    [LADO - 7, 0],
  ];
  for (const [l, c] of cantos) {
    if (linha < l || linha >= l + 7 || coluna < c || coluna >= c + 7) continue;
    const dl = linha - l;
    const dc = coluna - c;
    const borda = dl === 0 || dl === 6 || dc === 0 || dc === 6;
    const miolo = dl >= 2 && dl <= 4 && dc >= 2 && dc <= 4;
    return borda || miolo;
  }
  return false;
}

export function matrizQr(chave: string) {
  const proximo = embaralhar(chave);
  const linhas: boolean[][] = [];
  for (let l = 0; l < LADO; l++) {
    const linha: boolean[] = [];
    for (let c = 0; c < LADO; c++) {
      linha.push(
        dentroDoMarcador(l, c) ? marcadorAceso(l, c) : proximo() > 0.55,
      );
    }
    linhas.push(linha);
  }
  return linhas;
}

export const LADO_QR = LADO;
