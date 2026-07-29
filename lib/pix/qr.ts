import "server-only";

import QRCode from "qrcode";

/**
 * QR do pix, gerado no servidor a partir do BR Code de verdade.
 *
 * Sai como SVG (string) e viaja pronto para a tela: assim a biblioteca não vai
 * para o navegador e o QR aparece já no primeiro render, sem piscar.
 *
 * Correção de erro em M porque o payload é curto e o QR costuma ser lido de
 * perto, na tela do celular do cliente.
 */
export async function svgDoBrcode(brcode: string) {
  return QRCode.toString(brcode, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0B0B0B", light: "#F0EADA" },
  });
}
