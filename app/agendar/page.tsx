import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Logo } from "@/componentes/base";
import { Fluxo } from "@/componentes/agendar/Fluxo";
import { proximosDias } from "@/lib/agenda/dias";
import { barbeirosAtivos, casa, servicosAtivos } from "@/lib/dados/casa";
import { provedorAtual } from "@/lib/payments/provider";

/**
 * Só a moldura é cacheada: serviços, barbeiros e a régua de dias. A grade de
 * horários, que muda a todo minuto, continua vindo pela ação assim que o
 * cliente escolhe o serviço, então nada aqui fica velho.
 *
 * Cinco minutos porque a régua começa em "hoje": depois da virada da meia
 * noite, é o máximo que ela pode ficar defasada, e a essa hora a casa está
 * fechada.
 */
export const revalidate = 300;

export default async function Agendar() {
  const [barbearia, servicos, barbeiros] = await Promise.all([
    casa(),
    servicosAtivos(),
    barbeirosAtivos(),
  ]);

  const dias = proximosDias(7);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 py-3 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="-ml-2 inline-flex min-h-toque min-w-toque items-center justify-center rounded-pill text-texto-suave transition-colors hover:text-texto"
            aria-label="Voltar para o início"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <Logo tamanho={36} />
          <span className="truncate font-titulo text-base font-bold">
            {barbearia.nome}
          </span>
        </div>
      </header>

      <Fluxo
        servicos={servicos.map((s) => ({
          id: s.id,
          nome: s.nome,
          categoria: s.categoria,
          duracaoMin: s.duracao_min,
          precoCentavos: s.preco_centavos,
          cobertoPeloClube: s.coberto_pelo_clube,
          abateCentavos: s.abate_centavos,
          tag: s.tag,
        }))}
        barbeiros={barbeiros.map((b) => ({
          id: b.id,
          nome: b.apelido,
          nomeCompleto: b.nome,
          especialidade: b.especialidade ?? "",
          foto: b.foto_url ?? null,
        }))}
        dias={dias}
        clube={{
          ativo: barbearia.clube_ativo,
          precoCentavos: barbearia.clube_preco_centavos,
          cortesMes: barbearia.clube_cortes_mes,
        }}
        pagamentoObrigatorio={barbearia.pagamento_modalidade === "obrigatorio"}
        pedeCpf={provedorAtual().pedeCpf}
        reservaMinutos={barbearia.reserva_minutos}
      />
    </div>
  );
}
