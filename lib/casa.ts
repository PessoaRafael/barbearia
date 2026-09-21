/** Dados da casa que aparecem no site e no painel. */

/**
 * A grade da casa em números, não em frase.
 *
 * O site precisa responder "está aberto agora?", e isso não se pergunta a um
 * texto como "08:30 às 18:30". A frase do rodapé passa a sair daqui, então
 * mudar o horário é mexer em um lugar só — antes dava para corrigir o rodapé e
 * esquecer o resto.
 *
 * Isto é a vitrine, não a regra de agendamento: quem decide horário livre é o
 * expediente de cada barbeiro no banco. Os dois falam do mesmo dia, mas quem
 * manda na agenda é o banco.
 */
const GRADE = {
  /** 0 é domingo. Fora destas faixas, a casa está fechada. */
  turnos: [
    { de: 1, ate: 5, abre: "08:30", fecha: "18:30" },
    { de: 6, ate: 6, abre: "08:30", fecha: "17:30" },
  ],
  /** Cadeira parada: aparece como "almoço", não como fechado. */
  almoco: { inicio: "13:00", fim: "14:00" },
};

const DIAS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

const maiuscula = (t: string) => t[0].toUpperCase() + t.slice(1);

/** "Segunda a sexta", "Sábado". */
const faixaEmTexto = (de: number, ate: number) =>
  de === ate ? maiuscula(DIAS[de]) : `${maiuscula(DIAS[de])} a ${DIAS[ate]}`;

export const CASA = {
  nome: "Johny Barbearia",
  cidade: "Natal, RN",
  bairro: "Nova Descoberta",
  endereco: "R. Djalma Maranhão, 463-2, Nova Descoberta",
  cep: "59075-290",
  telefone: "(84) 99983-5180",
  /**
   * História da casa, contada pelo Johny. Não sai do banco de propósito: o
   * sistema nasceu agora e só conhece os clientes cadastrados nele, mas a
   * barbearia é bem mais velha que isso.
   *
   * É atendimento, não cliente: a mesma pessoa volta todo mês, e o número que
   * o Johny tem na cabeça é o de cadeiras ocupadas ao longo dos anos.
   */
  atendimentos: "+10.000",
  linkAgendamento: "johnybarbearia.com.br/agendar",
  instagram: "https://www.instagram.com/barbeariajohny/",
  /** Só dígitos, com o 55 na frente: serve para o wa.me. */
  whatsapp: "5584999835180",
  /**
   * O que vai no mapa e no "ver no mapa". Escrito por extenso e não montado a
   * partir dos campos acima: endereço quebrado em pedaços erra o pino, e
   * pino errado manda cliente para a rua errada.
   */
  enderecoCompleto:
    "R. Djalma Maranhão, 463-2, Nova Descoberta, Natal - RN, 59075-290",
  grade: GRADE,
  /** A mesma grade, em frase, para o rodapé. */
  expediente: [
    ...GRADE.turnos.map((t) => ({
      dia: faixaEmTexto(t.de, t.ate),
      horario: `${t.abre} às ${t.fecha}`,
    })),
    {
      dia: "Almoço",
      horario: `${GRADE.almoco.inicio} às ${GRADE.almoco.fim}, cadeira parada`,
    },
    { dia: "Domingo", horario: "fechado" },
  ],
};

export type EstadoDaCasa = {
  aberto: boolean;
  /** Frase curta, do jeito que se responde no balcão. */
  texto: string;
  /** Detalhe de apoio: até que horas, ou quando volta a abrir. */
  detalhe: string;
};

const emMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const turnoDo = (diaSemana: number) =>
  GRADE.turnos.find((t) => diaSemana >= t.de && diaSemana <= t.ate) ?? null;

/**
 * Está aberto agora?
 *
 * Função pura, com o dia e a hora vindos de fora, porque isto roda nos dois
 * lados: o servidor manda a primeira resposta já pronta para não piscar na
 * tela, e o navegador refaz a conta sozinho — a página fica dez minutos em
 * cache, e um cartaz de "aberto" errado às 18:35 é pior do que nenhum.
 *
 * @param diaSemana 0 (domingo) a 6.
 * @param hora      "HH:MM" no fuso da casa.
 */
export function estadoDaCasa(diaSemana: number, hora: string): EstadoDaCasa {
  const agora = emMinutos(hora);
  const hoje = turnoDo(diaSemana);

  if (hoje) {
    const abre = emMinutos(hoje.abre);
    const fecha = emMinutos(hoje.fecha);

    if (agora >= emMinutos(GRADE.almoco.inicio) && agora < emMinutos(GRADE.almoco.fim)) {
      return {
        aberto: true,
        texto: "No almoço",
        detalhe: `volta às ${GRADE.almoco.fim}`,
      };
    }
    if (agora >= abre && agora < fecha) {
      return { aberto: true, texto: "Aberto agora", detalhe: `até ${hoje.fecha}` };
    }
    if (agora < abre) {
      return { aberto: false, texto: "Fechado", detalhe: `abre hoje às ${hoje.abre}` };
    }
  }

  // Passou do fecha, ou é domingo: procura o próximo dia com turno.
  for (let i = 1; i <= 7; i++) {
    const proximo = (diaSemana + i) % 7;
    const turno = turnoDo(proximo);
    if (turno) {
      const quando = i === 1 ? "amanhã" : DIAS[proximo];
      return { aberto: false, texto: "Fechado", detalhe: `abre ${quando} às ${turno.abre}` };
    }
  }

  return { aberto: false, texto: "Fechado", detalhe: "" };
}
