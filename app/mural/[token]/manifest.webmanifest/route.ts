import { NextResponse } from "next/server";

import { muralDoDia } from "@/lib/dados/mural";

/**
 * O manifesto do mural, um por barbearia.
 *
 * O site já tinha um manifesto apontando para /painel. Quando o Johny colocou
 * o mural na tela inicial do tablet, o Android usou aquele endereço em vez do
 * que estava aberto: o ícone abria o painel e pedia a chave toda vez.
 *
 * Aqui o `start_url` carrega o token, então o ícone abre direto no mural da
 * casa — sem login, que é o ponto de existir um endereço com token.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const dados = await muralDoDia(token);

  if (!dados) {
    return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  }

  return NextResponse.json(
    {
      name: `Agenda do dia · ${dados.casa}`,
      short_name: "Agenda",
      description: "Os horários do dia, por barbeiro.",
      start_url: `/mural/${token}`,
      scope: `/mural/${token}`,
      display: "standalone",
      background_color: "#12100e",
      theme_color: "#12100e",
      icons: [
        { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icone-mask.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
