/**
 * Monta os guias com a logo real embutida e gera os PDFs pelo Chrome headless.
 *
 * A logo entra como base64 no próprio HTML: assim o arquivo é um só, o PDF sai
 * com a imagem certa e o guia continua abrindo mesmo fora da pasta do projeto.
 *
 *   npm run guia            os dois
 *   npm run guia -- cliente só o do cliente
 *   npm run guia -- johny   só o da equipe
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const RAIZ = process.cwd();

const GUIAS = {
  johny: {
    modelo: "material/guia-de-uso.html",
    html: "material/guia-johny-barbearia.html",
    pdf: "material/guia-johny-barbearia.pdf",
  },
  cliente: {
    modelo: "material/guia-cliente.html",
    html: "material/guia-cliente-pronto.html",
    pdf: "material/guia-cliente.pdf",
  },
};

const pedidos = process.argv.slice(2).filter((a) => a in GUIAS);
const aGerar = pedidos.length ? pedidos : Object.keys(GUIAS);

const NAVEGADORES = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const logo = readFileSync(resolve(RAIZ, "public/logo.jpg")).toString("base64");

const navegador = NAVEGADORES.find((c) => c && existsSync(c));

for (const nome of aGerar) {
  const guia = GUIAS[nome];
  const modelo = resolve(RAIZ, guia.modelo);
  const saidaHtml = resolve(RAIZ, guia.html);
  const saidaPdf = resolve(RAIZ, guia.pdf);

  writeFileSync(
    saidaHtml,
    readFileSync(modelo, "utf8").replace(
      /__LOGO__/g,
      `data:image/jpeg;base64,${logo}`,
    ),
    "utf8",
  );
  console.log(`
${nome}`);
  console.log(`  html: ${saidaHtml}`);

  if (!navegador) {
    console.error("  sem Chrome nem Edge: abra o html e use Ctrl+P > salvar como PDF.");
    continue;
  }

  /**
   * Perfil descartável é obrigatório: com o Chrome já aberto, o headless tenta
   * reusar o perfil do usuário, o processo devolve na hora e o PDF nunca é
   * escrito, sem erro nenhum na tela.
   */
  const perfil = resolve(tmpdir(), `guia-chrome-${process.pid}-${nome}`);

  execFileSync(
    navegador,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      `--user-data-dir=${perfil}`,
      "--no-pdf-header-footer",
      "--virtual-time-budget=6000",
      `--print-to-pdf=${saidaPdf}`,
      `file:///${saidaHtml.replace(/\\/g, "/")}`,
    ],
    { stdio: "inherit" },
  );

  rmSync(perfil, { recursive: true, force: true });

  const gerado = statSync(saidaPdf);
  console.log(`  pdf:  ${saidaPdf}`);
  console.log(
    `        ${Math.round(gerado.size / 1024)} KB, ${gerado.mtime.toLocaleTimeString("pt-BR")}`,
  );
}
