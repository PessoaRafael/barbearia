/**
 * Relatório de um dia de operação, montado com os números do banco.
 *
 *   npm run relatorio              o dia de hoje
 *   npm run relatorio -- 2026-08-12   um dia específico
 *
 * Lê tudo na hora e escreve o HTML já com os valores dentro, para o PDF ser um
 * retrato daquele momento: relatório que recalcula quando alguém abre não serve
 * para comparar com o de ontem.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

for (const arquivo of [".env.local", ".env"]) {
  try {
    for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
      const par = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (par && !process.env[par[1]]) {
        process.env[par[1]] = par[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}

const RAIZ = process.cwd();
const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: K, Authorization: `Bearer ${K}` };

const hoje = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Fortaleza",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const DIA = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? hoje;
const INICIO = `${DIA}T00:00:00-03:00`;
const proximo = new Date(`${DIA}T12:00:00-03:00`);
proximo.setDate(proximo.getDate() + 1);
const FIM = `${proximo.toISOString().slice(0, 10)}T00:00:00-03:00`;

const q = async (u) => (await fetch(`${U}/rest/v1/${u}`, { headers: h })).json();
const um = (v) => (Array.isArray(v) ? v[0] : v);
const real = (c) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const pt = (d) => d.split("-").reverse().join("/");

// --------------------------------------------------------------------- coleta
const doDia = await q(
  `appointments?select=inicio,status,valor_centavos,usou_credito_clube,barbers(apelido),services(nome)&inicio=gte.${INICIO}&inicio=lt.${FIM}`,
);
const criados = await q(
  `appointments?select=id,origem&criado_em=gte.${INICIO}&criado_em=lt.${FIM}`,
);
const caixa = await q(`cash_entries?select=valor_centavos,categoria&data=eq.${DIA}`);
const entradas = await q(
  `login_attempts?select=sucesso&criado_em=gte.${INICIO}&criado_em=lt.${FIM}`,
);
const assinantes = await q(
  "subscriptions?select=preco_centavos,club_plans(nome,dias_semana)&status=eq.ativa",
);
const chaves = await q(
  "access_keys?select=role,ultimo_acesso&role=eq.client&revogada_em=is.null",
);
const clientes = await q("clients?select=id");
const pendentes = await q("notifications?select=id&status=eq.pendente");

const conta = (lista, chave) =>
  lista.reduce((o, x) => {
    const k = chave(x);
    o[k] = (o[k] ?? 0) + 1;
    return o;
  }, {});

const status = conta(doDia, (a) => a.status);
const servicos = conta(doDia, (a) => um(a.services)?.nome ?? "?");
const barbeiros = conta(doDia, (a) => um(a.barbers)?.apelido ?? "?");
const origens = conta(criados, (a) => a.origem);

const peloClube = doDia.filter((a) => a.usou_credito_clube).length;
const aReceber = doDia
  .filter((a) => !a.usou_credito_clube && a.status !== "cancelado")
  .reduce((s, a) => s + a.valor_centavos, 0);
const entrou = caixa.reduce((s, c) => s + c.valor_centavos, 0);

const mensalidade = assinantes.reduce((s, a) => s + a.preco_centavos, 0);
const usadas = chaves.filter((c) => c.ultimo_acesso).length;
const certas = entradas.filter((e) => e.sucesso).length;

const aconteceram = (status.concluido ?? 0) + (status.confirmado ?? 0);
const perdidos = (status.cancelado ?? 0) + (status.faltou ?? 0);

const barra = (n, total) =>
  `<div class="barra"><span style="width:${total ? Math.round((n / total) * 100) : 0}%"></span></div>`;

const lista = (obj, total) =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([k, v]) =>
        `<tr><td>${k}</td><td class="n">${v}</td><td class="w">${barra(v, total)}</td></tr>`,
    )
    .join("");

// ----------------------------------------------------------------------- html
const logo = readFileSync(resolve(RAIZ, "public/logo.jpg")).toString("base64");

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Johny Barbearia — relatório de ${pt(DIA)}</title>
<style>
  @page { size: A4; margin: 0; }
  :root {
    --tinta:#17140e; --suave:#6f6858; --fraco:#9a927e; --linha:#e6dfcd;
    --papel:#fffefa; --creme:#faf6ea; --amarelo:#F5CE0A; --laranja:#C9622F; --verde:#6f7d3c;
  }
  * { box-sizing: border-box; }
  html { background:#cfcabb; }
  body { margin:0; color:var(--tinta); font:13px/1.5 "Segoe UI",system-ui,sans-serif;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .folha { width:210mm; min-height:297mm; margin:0 auto; padding:14mm 16mm; background:var(--papel); }
  .folha + .folha { margin-top:8mm; }
  @media print { html{background:none} .folha,.folha+.folha{margin:0;box-shadow:none} .folha{break-after:page} .folha:last-child{break-after:auto} }
  @media screen { .folha{box-shadow:0 3px 18px rgba(0,0,0,.2)} }

  h1 { font-size:23px; margin:0 0 2px; letter-spacing:-.02em; }
  h2 { font-size:16px; margin:18px 0 8px; letter-spacing:-.015em; }
  h3 { font-size:11.5px; margin:14px 0 6px; text-transform:uppercase; letter-spacing:.07em; color:var(--suave); }
  p { margin:0 0 8px; }
  .cab { display:flex; align-items:center; gap:11px; padding-bottom:10px; margin-bottom:14px; border-bottom:2px solid var(--linha); }
  .cab img { width:42px; height:42px; border-radius:10px; }
  .cab .sub { font-size:12px; color:var(--suave); }

  .cartoes { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin:12px 0 4px; }
  .cartao { border:1px solid var(--linha); border-radius:9px; padding:10px 12px; background:var(--creme); }
  .cartao .rot { font-size:10.5px; color:var(--suave); text-transform:uppercase; letter-spacing:.05em; }
  .cartao .num { font-size:24px; font-weight:800; letter-spacing:-.03em; line-height:1.2; }
  .cartao .pe { font-size:10.5px; color:var(--fraco); }
  .cartao.forte { background:#fdf7de; border-color:#e7d68a; }

  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  td { padding:4px 0; border-bottom:1px solid var(--linha); vertical-align:middle; }
  td.n { text-align:right; width:36px; font-weight:700; }
  td.w { width:45%; padding-left:10px; }
  .barra { background:#eee7d4; border-radius:999px; height:7px; overflow:hidden; }
  .barra span { display:block; height:100%; background:var(--amarelo); border-radius:999px; }

  .duas { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  .aviso { border-left:3px solid var(--amarelo); background:#fdf7de; padding:9px 12px; margin:10px 0; border-radius:0 7px 7px 0; font-size:12.5px; }
  .aviso.atencao { border-color:var(--laranja); background:#fbeee8; }
  .aviso.bom { border-color:var(--verde); background:#f2f4e6; }
  .aviso strong { display:block; margin-bottom:2px; }
  .rodape { margin-top:16px; padding-top:9px; border-top:1px solid var(--linha); font-size:10.5px; color:var(--fraco); display:flex; justify-content:space-between; }
</style></head><body>

<section class="folha">
  <div class="cab">
    <img src="data:image/jpeg;base64,${logo}" alt="">
    <div>
      <h1>Primeiro dia de uso do sistema</h1>
      <div class="sub">Johny Barbearia · ${pt(DIA)}</div>
    </div>
  </div>

  <p>
    Este é o retrato do dia em que o sistema passou a ser usado de verdade pelos
    clientes: os links do Clube foram enviados de manhã e o agendamento pelo site
    ficou aberto para todo mundo.
  </p>

  <div class="cartoes">
    <div class="cartao forte">
      <div class="rot">Marcados hoje</div>
      <div class="num">${criados.length}</div>
      <div class="pe">agendamentos criados</div>
    </div>
    <div class="cartao">
      <div class="rot">Na agenda do dia</div>
      <div class="num">${doDia.length}</div>
      <div class="pe">${peloClube} pelo clube</div>
    </div>
    <div class="cartao">
      <div class="rot">Clientes</div>
      <div class="num">${clientes.length}</div>
      <div class="pe">na base</div>
    </div>
    <div class="cartao">
      <div class="rot">Entradas no site</div>
      <div class="num">${certas}</div>
      <div class="pe">acessos com chave</div>
    </div>
  </div>

  <h2>O Clube</h2>

  <div class="duas">
    <div>
      <table>
        ${Object.entries(
          assinantes.reduce((o, a) => {
            const p = um(a.club_plans);
            const nome = `${p?.nome}${p?.dias_semana?.includes(6) ? " (antigos)" : ""}`;
            o[nome] = (o[nome] ?? 0) + 1;
            return o;
          }, {}),
        )
          .map(([k, v]) => `<tr><td>${k}</td><td class="n">${v}</td><td class="w">${barra(v, assinantes.length)}</td></tr>`)
          .join("")}
        <tr><td><strong>Total por ciclo</strong></td><td class="n" colspan="2" style="text-align:left;padding-left:10px"><strong>${real(mensalidade)}</strong></td></tr>
      </table>

      <div class="aviso bom">
        <strong>${usadas} de ${chaves.length} assinantes já entraram</strong>
        ${Math.round((usadas / Math.max(1, chaves.length)) * 100)}% usou o link de
        acesso no primeiro dia. Para um público que nunca tinha usado o sistema,
        é adesão alta.
      </div>
    </div>

    <div>
      <h3>Serviços procurados</h3>
      <table>${lista(servicos, doDia.length)}</table>

      <h3>Por barbeiro</h3>
      <table>${lista(barbeiros, doDia.length)}</table>
    </div>
  </div>

  <h2>Dinheiro</h2>
  <table>
    <tr><td>Entrou no caixa hoje</td><td class="n" style="width:auto"><strong>${real(entrou)}</strong></td></tr>
    <tr><td>A receber dos horários do dia</td><td class="n" style="width:auto">${real(aReceber)}</td></tr>
    <tr><td>Atendimentos cobertos pelo Clube</td><td class="n" style="width:auto">${peloClube}</td></tr>
  </table>

  <div class="rodape">
    <span>Johny Barbearia · relatório gerado automaticamente</span>
    <span>página 1 de 2</span>
  </div>
</section>

<section class="folha">
  <div class="cab">
    <img src="data:image/jpeg;base64,${logo}" alt="">
    <div>
      <h1>O que funcionou e o que precisa de atenção</h1>
      <div class="sub">${pt(DIA)}</div>
    </div>
  </div>

  <h2>Como terminaram os ${doDia.length} horários do dia</h2>
  <table>${lista(status, doDia.length)}</table>

  <div class="aviso ${perdidos > aconteceram ? "atencao" : ""}">
    <strong>${aconteceram} aconteceram · ${perdidos} não</strong>
    Cancelamento e falta somaram ${Math.round((perdidos / Math.max(1, doDia.length)) * 100)}% do dia.
    Parte disso é gente experimentando o sistema no primeiro dia — vale comparar
    com amanhã antes de tirar conclusão.
  </div>

  <h2>Pontos de atenção</h2>

  <div class="aviso atencao">
    <strong>Pagamento online travado</strong>
    A conta do PagBank ainda não foi liberada para a API, e durante parte do dia
    quem ia pagar recebeu erro ao confirmar. Já foi corrigido: agora o sistema
    cai sozinho para o pix normal, na chave da barbearia. Nenhum agendamento
    depende mais dessa liberação.
  </div>

  <div class="aviso">
    <strong>${pendentes.length} avisos de WhatsApp na fila</strong>
    O sistema escreve a mensagem, mas o envio depende de um clique no painel.
    Quem marcou não recebeu confirmação por lá — embora a própria tela já
    confirme na hora.
  </div>

  <div class="aviso">
    <strong>Marcar pelo chat: ${origens.chat ?? 0} de ${criados.length}</strong>
    Todo mundo usou as telas; ninguém fechou pelo chat. Ou o botão não está
    sendo visto, ou a conversa trava em algum ponto. Vale investigar.
  </div>

  <h2>O que já está de pé</h2>
  <ul style="margin:0;padding-left:18px">
    <li>Agenda em tempo real: dois clientes não conseguem pegar o mesmo horário</li>
    <li>Clube reconhecido pelo WhatsApp, sem o cliente precisar avisar</li>
    <li>Área do assinante com histórico e cancelamento pelo próprio cliente</li>
    <li>Regra de dias por plano: segunda a quinta, e até sábado para os antigos</li>
    <li>Bloqueio de agenda pelo painel, para dia cheio ou imprevisto</li>
    <li>Fila de espera quando o dia lota</li>
  </ul>

  <div class="rodape">
    <span>Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</span>
    <span>página 2 de 2</span>
  </div>
</section>

</body></html>`;

const saidaHtml = resolve(RAIZ, `material/relatorio-${DIA}.html`);
const saidaPdf = resolve(RAIZ, `material/relatorio-${DIA}.pdf`);
writeFileSync(saidaHtml, html, "utf8");
console.log(`html: ${saidaHtml}`);

const NAVEGADORES = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const navegador = NAVEGADORES.find((c) => c && existsSync(c));
if (!navegador) {
  console.error("Sem Chrome nem Edge: abra o html e use Ctrl+P > salvar como PDF.");
  process.exit(0);
}

const perfil = resolve(tmpdir(), `relatorio-chrome-${process.pid}`);
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
console.log(`pdf:  ${saidaPdf}`);
console.log(`      ${Math.round(gerado.size / 1024)} KB`);
