import { NextResponse, type NextRequest } from "next/server";

/**
 * Porteiro barato: só confere se existe cookie de sessão, para não deixar
 * anônimo abrir tela interna. Quem vale de verdade é `lerSessao`, que relê a
 * chave no banco, e o RLS. O middleware roda no edge e não fala com o banco.
 */

const INTERNAS = ["/painel", "/agenda", "/clube"];

export function middleware(requisicao: NextRequest) {
  const { pathname } = requisicao.nextUrl;
  const temCookie = Boolean(requisicao.cookies.get("johny_sessao")?.value);

  if (INTERNAS.some((rota) => pathname.startsWith(rota)) && !temCookie) {
    const destino = requisicao.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  // Quem já tem sessão e abre /entrar continua vendo o formulário de propósito.
  // Mandar /entrar de volta para /painel fecharia um laço infinito sempre que a
  // sessão fosse recusada no servidor: a página manda para /entrar, o
  // middleware manda de volta, e assim por diante.

  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/agenda/:path*", "/clube/:path*"],
};
