# Johny Barbearia

Front-end completo da barbearia em Next.js (App Router, TypeScript, Tailwind).
Sem back-end: os dados vivem em arquivos `.ts` na raiz e o estado é local com
`useState`.

## Rodar

```bash
npm install
npm run dev
```

## Publicar

```bash
vercel deploy
```

Dependências de runtime: `next`, `react`, `react-dom` e `lucide-react`.

## Telas

| Rota       | O que tem                                                              |
| ---------- | ---------------------------------------------------------------------- |
| `/`        | Landing: hero, serviços com preço, Clube Johny, time e horário da casa. |
| `/agendar` | Fluxo de 5 passos empilhados, um aberto por vez, com pix e clube.       |
| `/painel`  | Painel do barbeiro: agenda em timeline, clube, clientes, serviços, caixa. |

## Dados mockados

| Arquivo       | Conteúdo                                                        |
| ------------- | --------------------------------------------------------------- |
| `tema.ts`     | Cores, tipografia e formas — espelhadas em `tailwind.config.ts`. |
| `servicos.ts` | Os 7 serviços, categorias e o cálculo do abatimento do clube.    |
| `agenda.ts`   | Barbeiros, régua de 7 dias, grade de horários e ocupação.        |
| `painel.ts`   | Cliente logado, clube, pix, agenda do dia e métricas do painel.  |

`lib/` tem só derivações desses dados: disponibilidade por duração real do
serviço, formatação de número e dinheiro, configuração das abas do painel e o
desenho do QR de placeholder.

## Tema

Tema escuro único. Amarelo (`#F5CE0A`) aparece só em ação, item selecionado e
valor em destaque. Títulos e números em Outfit, texto em DM Sans, nada menor que
13px, todo número com `tabular-nums` e `nowrap`.

## Responsividade

Uma base mobile-first com quebras em 640, 1024 e 1280. Alvos de toque de 44px,
listas horizontais com scroll (dias, categorias, menu do painel) e tudo em
flex/grid com `gap`.
