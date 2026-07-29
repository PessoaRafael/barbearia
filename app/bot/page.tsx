import { Conversa } from "@/componentes/bot/Conversa";
import { abertura } from "./acoes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marcar pelo chat · Johny Barbearia",
};

export default async function Bot() {
  const inicio = await abertura();

  return (
    <Conversa
      aberturaFalas={inicio.falas}
      aberturaOpcoes={inicio.opcoes}
      exemplos={inicio.exemplos ?? []}
    />
  );
}
