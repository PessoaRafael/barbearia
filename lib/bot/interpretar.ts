/**
 * O "cérebro" do bot: casamento de padrões, não IA.
 *
 * O truque que faz parecer inteligente não é entender a frase — é tentar
 * extrair TODOS os dados de uma vez. Quem escreve "quero degradê amanhã de
 * tarde com o Diego" preenche quatro campos numa tacada e o bot só pergunta o
 * que sobrou. Um passo por pergunta é o que denuncia formulário disfarçado.
 *
 * Tudo aqui é função pura, sem banco: dá para testar sem subir nada.
 */

export type Extraido = {
  servicoId?: string;
  barbeiroId?: string | null;
  data?: string;
  hora?: string;
  turno?: "manha" | "tarde";
  nome?: string;
  telefone?: string;
  forma?: "pix" | "cadeira" | "clube";
  intencao?: "cancelar" | "preco" | "endereco" | "horario" | "clube" | "saudacao";
};

const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(ACENTOS, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distância de edição curta, para perdoar "degrade" escrito como "degrad". */
function parecido(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  if (a.includes(b) || b.includes(a)) return true;

  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j];
      linha[j] = Math.min(
        linha[j] + 1,
        linha[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      anterior = guardado;
    }
  }
  return linha[b.length] <= 2;
}

/**
 * Acha o item citado no texto.
 *
 * Pontua todos e fica com o melhor, em vez de aceitar o primeiro que passar:
 * "corte degradê" tem a palavra "corte", que também está em "Corte social", e
 * o primeiro-que-serve escolheria errado. Só palavra DISTINTIVA — presente no
 * nome de um item só — decide.
 */
export function acharPorNome<T extends { id: string; nome: string }>(
  texto: string,
  itens: T[],
  apelidos: Record<string, string[]> = {},
): T | null {
  const limpo = normalizar(texto);
  const palavras = limpo.split(" ").filter((p) => p.length >= 3);

  // Palavra que aparece no nome de mais de um item não distingue nada.
  const vezes = new Map<string, number>();
  for (const item of itens) {
    for (const palavra of new Set(normalizar(item.nome).split(" "))) {
      vezes.set(palavra, (vezes.get(palavra) ?? 0) + 1);
    }
  }

  let melhor: { item: T; ponto: number } | null = null;
  const anotar = (item: T, ponto: number) => {
    if (!melhor || ponto > melhor.ponto) melhor = { item, ponto };
  };

  for (const item of itens) {
    const alvo = normalizar(item.nome);

    // Nome inteiro no texto: não tem como ser outro.
    if (limpo.includes(alvo)) {
      anotar(item, 100);
      continue;
    }

    for (const apelido of apelidos[item.id] ?? []) {
      const limpoApelido = normalizar(apelido);
      if (limpoApelido.length >= 3 && limpo.includes(limpoApelido)) {
        anotar(item, 80);
      }
    }

    for (const palavra of new Set(alvo.split(" "))) {
      if (palavra.length < 4 || (vezes.get(palavra) ?? 0) > 1) continue;

      if (limpo.includes(palavra)) anotar(item, 60);
      else if (palavras.some((p) => parecido(p, palavra))) anotar(item, 40);
    }
  }

  return melhor ? (melhor as { item: T }).item : null;
}

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

/**
 * "hoje", "amanhã", "sexta", "dia 5", "05/08". Recebe a régua já calculada no
 * servidor para não inventar fuso.
 */
export function acharData(
  texto: string,
  dias: { data: string; numero: string; mes: string; fechado: boolean }[],
) {
  const limpo = normalizar(texto);
  const abertos = dias.filter((d) => !d.fechado);

  if (/\bhoje\b/.test(limpo)) return dias[0]?.data;
  if (/\b(amanha|amanhã)\b/.test(limpo)) return dias[1]?.data;
  if (/depois de amanha/.test(limpo)) return dias[2]?.data;

  for (const [nome, numero] of Object.entries(DIAS_SEMANA)) {
    if (!limpo.includes(nome)) continue;
    const achado = dias.find(
      (d) => new Date(`${d.data}T12:00:00-03:00`).getUTCDay() === numero,
    );
    if (achado) return achado.data;
  }

  // "dia 5", "5/8", "05/08"
  const barra = limpo.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (barra) {
    const achado = abertos.find((d) => Number(d.numero) === Number(barra[1]));
    if (achado) return achado.data;
  }

  const solto = limpo.match(/\bdia\s+(\d{1,2})\b/);
  if (solto) {
    const achado = abertos.find((d) => Number(d.numero) === Number(solto[1]));
    if (achado) return achado.data;
  }

  return undefined;
}

/** "15h", "15:30", "3 da tarde", "meio dia". */
export function acharHora(texto: string) {
  const limpo = normalizar(texto);

  if (/meio dia/.test(limpo)) return "12:00";

  const comMinuto = limpo.match(/\b(\d{1,2})\s*[:h]\s*(\d{2})\b/);
  if (comMinuto) {
    const h = Number(comMinuto[1]);
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, "0")}:${comMinuto[2]}`;
    }
  }

  const soHora = limpo.match(/\b(\d{1,2})\s*h\b/);
  if (soHora) {
    const h = Number(soHora[1]);
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, "0")}:00`;
  }

  // "3 da tarde" vira 15:00; "9 da manhã" fica 09:00.
  const periodo = limpo.match(/\b(\d{1,2})\s*(?:da|de|na)\s*(manha|tarde|noite)\b/);
  if (periodo) {
    let h = Number(periodo[1]);
    if (periodo[2] !== "manha" && h < 12) h += 12;
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, "0")}:00`;
  }

  return undefined;
}

export function acharTurno(texto: string): "manha" | "tarde" | undefined {
  const limpo = normalizar(texto);
  if (/\bmanha\b|\bcedo\b/.test(limpo)) return "manha";
  if (/\btarde\b|\bfim do dia\b|\bnoite\b/.test(limpo)) return "tarde";
  return undefined;
}

export function acharTelefone(texto: string) {
  const digitos = texto.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return digitos;
  if (digitos.length === 12 || digitos.length === 13) {
    return digitos.replace(/^55/, "");
  }
  return undefined;
}

export function acharForma(texto: string): Extraido["forma"] {
  const limpo = normalizar(texto);
  if (/\bpix\b|qr|codigo/.test(limpo)) return "pix";
  if (/clube|assinat|credito|mensalidade/.test(limpo)) return "clube";
  if (/dinheiro|cartao|especie|na hora|la mesmo|cadeira|debito|credito na maquina/.test(limpo)) {
    return "cadeira";
  }
  return undefined;
}

/** Perguntas que não são agendamento e merecem resposta direta. */
export function acharIntencao(texto: string): Extraido["intencao"] {
  const limpo = normalizar(texto);

  if (/^(oi|ola|opa|eae|e ai|bom dia|boa tarde|boa noite|fala)\b/.test(limpo)) {
    return "saudacao";
  }
  if (/cancel|desmarc|remarc|adiar/.test(limpo)) return "cancelar";
  if (/quanto|preco|valor|custa|tabela/.test(limpo)) return "preco";
  if (/onde|endereco|fica|localiza|chegar|mapa/.test(limpo)) return "endereco";
  if (/que horas|abre|fecha|funciona|expediente|domingo/.test(limpo)) return "horario";
  if (/clube|assinatura|mensal/.test(limpo)) return "clube";

  return undefined;
}

/** Nome próprio: só aceita quando a frase é curta e não tem outra pista. */
export function acharNome(texto: string) {
  const cru = texto.trim();
  if (cru.length < 2 || cru.length > 60) return undefined;
  if (/\d/.test(cru)) return undefined;

  const limpo = normalizar(cru);
  const ruido = /marcar|agendar|corte|barba|quero|queria|pode|ser|hoje|amanha|pix|dinheiro|sim|nao|ok/;
  if (ruido.test(limpo)) return undefined;

  const palavras = cru.split(/\s+/);
  if (palavras.length > 4) return undefined;

  return cru
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}
