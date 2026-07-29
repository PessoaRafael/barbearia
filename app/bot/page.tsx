import { Conversa } from "@/componentes/bot/Conversa";
import { abertura } from "./acoes";

/**
 * A abertura do chat não precisa ser dinâmica: serviços, barbeiros e preços
 * mudam raramente. Servida do cache, a tela abre na hora, e a
 * disponibilidade, que muda a todo minuto, continua vindo pela ação a cada
 * mensagem. Editou um serviço no painel? O revalidatePath derruba este cache
 * na hora, então não fica velho.
 */
export const revalidate = 600;

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
