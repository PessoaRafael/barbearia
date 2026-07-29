import { NextResponse, type NextRequest } from "next/server";

/**
 * Porteiro barato: só confere se existe cookie de sessão, para não deixar
 * anônimo abrir tela interna. Quem vale de verdade é `lerSessao`, que relê a
 * chave no banco, e o RLS. O middleware roda no edge e não fala com o banco.
 */

const INTERNAS = ["/painel", "/agenda"];

export function middleware(requisicao: NextRequest) {
  const { pathname } = requisicao.nextUrl;
  const temCookie = Boolean(requisicao.cookies.get("johny_sessao")?.value);

  if (INTERNAS.some((rota) => pathname.startsWith(rota)) && !temCookie) {
    const destino = requisicao.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  if (pathname === "/entrar" && temCookie) {
    const papel = requisicao.cookies.get("johny_papel")?.value;
    const destino = requisicao.nextUrl.clone();
    destino.pathname = papel === "barber" ? "/agenda" : "/painel";
    return NextResponse.redirect(destino);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/agenda/:path*", "/entrar"],
};
