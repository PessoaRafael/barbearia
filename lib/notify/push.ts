import "server-only";

import webpush from "web-push";

import { clienteServico } from "@/lib/supabase/servidor";

/**
 * Aviso no celular do barbeiro.
 *
 * Eles estão com a máquina na mão quando alguém marca. Som não resolve — a
 * barbearia é barulhenta e o telefone fica no bolso. Notificação do sistema
 * aparece na tela bloqueada e fica lá até alguém olhar.
 *
 * Nada aqui pode derrubar um agendamento: se o envio falhar, o horário já
 * está gravado e o painel mostra do mesmo jeito. Por isso tudo é engolido e
 * só vira log.
 */

const TETO_DE_FALHAS = 3;

function pronto() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;

  webpush.setVapidDetails(
    `mailto:${process.env.EMAIL_CONTATO ?? "contato@johnybarbearia.com.br"}`,
    pub,
    priv,
  );
  return true;
}

export type Aviso = {
  titulo: string;
  corpo: string;
  /** Para onde o toque leva. */
  url?: string;
  /** Avisos do mesmo grupo se substituem em vez de empilhar. */
  grupo?: string;
};

/**
 * Manda para os aparelhos de um barbeiro — ou de todo mundo, quando o
 * barbeiro não importa (o dono quer saber de tudo).
 */
export async function avisarNoCelular(entrada: {
  barbeariaId: string;
  /** null manda para a casa inteira. */
  barbeiroId?: string | null;
  aviso: Aviso;
}) {
  if (!pronto()) return { enviados: 0, motivo: "sem chaves" };

  const supabase = clienteServico();

  let consulta = supabase
    .from("push_inscricoes")
    .select("id, endpoint, p256dh, auth, falhas")
    .eq("barbershop_id", entrada.barbeariaId)
    .lt("falhas", TETO_DE_FALHAS);

  /**
   * O dono recebe tudo, o barbeiro só o que é dele.
   *
   * `or` em vez de igualdade: a inscrição do Johny não tem barbeiro atrelado
   * quando ele entra como dono, e sem isto ele deixaria de ser avisado dos
   * horários dos outros dois — que é justamente o que ele quer acompanhar.
   */
  if (entrada.barbeiroId) {
    consulta = consulta.or(`barber_id.eq.${entrada.barbeiroId},barber_id.is.null`);
  }

  const { data: inscricoes } = await consulta;
  if (!inscricoes?.length) return { enviados: 0, motivo: "ninguem inscrito" };

  const corpo = JSON.stringify(entrada.aviso);
  let enviados = 0;

  await Promise.all(
    inscricoes.map(async (i) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: i.endpoint as string,
            keys: { p256dh: i.p256dh as string, auth: i.auth as string },
          },
          corpo,
          { TTL: 60 * 30 },
        );

        enviados++;
        await supabase
          .from("push_inscricoes")
          .update({ ultimo_envio: new Date().toISOString(), falhas: 0 })
          .eq("id", i.id);
      } catch (erro) {
        const status = (erro as { statusCode?: number }).statusCode;

        /**
         * 404 e 410 são definitivos: o navegador diz que aquele endereço não
         * existe mais. Aparelho formatado, aplicativo desinstalado, permissão
         * revogada. Insistir é gastar chamada à toa para sempre.
         */
        if (status === 404 || status === 410) {
          await supabase.from("push_inscricoes").delete().eq("id", i.id);
          return;
        }

        await supabase
          .from("push_inscricoes")
          .update({ falhas: ((i.falhas as number) ?? 0) + 1 })
          .eq("id", i.id);

        console.warn("push falhou:", status ?? (erro as Error).message);
      }
    }),
  );

  return { enviados };
}
