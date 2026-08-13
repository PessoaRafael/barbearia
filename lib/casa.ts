/** Dados da casa que aparecem no site e no painel. */
export const CASA = {
  nome: "Johny Barbearia",
  cidade: "Natal, RN",
  endereco: "R. Djalma Maranhão, 463-2, Nova Descoberta",
  cep: "59075-290",
  telefone: "(84) 99983-5180",
  /**
   * História da casa, contada pelo Johny. Não sai do banco de propósito: o
   * sistema nasceu agora e só conhece os clientes cadastrados nele, mas a
   * barbearia é bem mais velha que isso.
   */
  clientesAtendidos: "+500",
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
  expediente: [
    { dia: "Segunda a sexta", horario: "08:30 às 18:30" },
    { dia: "Sábado", horario: "08:30 às 17:30" },
    { dia: "Almoço", horario: "13:00 às 14:00, cadeira parada" },
    { dia: "Domingo", horario: "fechado" },
  ],
};
