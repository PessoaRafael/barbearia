/**
 * Monta o guia com a logo real embutida e gera o PDF pelo Chrome headless.
 *
 * A logo entra como base64 no próprio HTML: assim o arquivo é um só, o PDF sai
 * com a imagem certa e o guia continua abrindo mesmo fora da pasta do projeto.
 *
 * Uso: npm run guia
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const RAIZ = process.cwd();
const MODELO = resolve(RAIZ, "material/guia-de-uso.html");
const SAIDA_HTML = resolve(RAIZ, "material/guia-johny-barbearia.html");
const SAIDA_PDF = resolve(RAIZ, "material/guia-johny-barbearia.pdf");

const NAVEGADORES = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const logo = readFileSync(resolve(RAIZ, "public/logo.jpg")).toString("base64");

const html = readFileSync(MODELO, "utf8").replace(
  /__LOGO__/g,
  `data:image/jpeg;base64,${logo}`,
);

writeFileSync(SAIDA_HTML, html, "utf8");
console.log(`html: ${SAIDA_HTML}`);

const navegador = NAVEGADORES.find((c) => c && existsSync(c));
if (!navegador) {
  console.error(
    "\nNão achei Chrome nem Edge. O HTML está pronto: abra e use Ctrl+P > Salvar como PDF.",
  );
  process.exit(0);
}

/**
 * Perfil descartável é obrigatório: com o Chrome já aberto, o headless tenta
 * reusar o perfil do usuário, o processo devolve na hora e o PDF nunca é
 * escrito, sem erro nenhum na tela.
 */
const perfil = resolve(tmpdir(), `guia-chrome-${process.pid}`);

execFileSync(
  navegador,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--user-data-dir=${perfil}`,
    "--no-pdf-header-footer",
    "--virtual-time-budget=6000",
    `--print-to-pdf=${SAIDA_PDF}`,
    `file:///${SAIDA_HTML.replace(/\\/g, "/")}`,
  ],
  { stdio: "inherit" },
);

rmSync(perfil, { recursive: true, force: true });

const gerado = statSync(SAIDA_PDF);
console.log(`pdf:  ${SAIDA_PDF}`);
console.log(`      ${Math.round(gerado.size / 1024)} KB, ${gerado.mtime.toLocaleTimeString("pt-BR")}`);
