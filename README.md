# Johny Barbearia

Agendamento da Johny Barbearia (Natal/RN). Next.js (App Router) + TypeScript +
Tailwind na frente, Supabase (Postgres + RLS) atrás. Deploy na Vercel.

**Não existe login com e-mail e senha em lugar nenhum.** Todo acesso interno é
por chave no formato `JHNY-XXXX-XXXX`, que o Johny gera e entrega por WhatsApp.

## Subir do zero

```bash
npm install
cp .env.example .env.local     # preencha com as chaves do seu projeto Supabase
```

Rode as migrations na ordem, um arquivo por vez, pelo SQL Editor do Supabase ou
pela CLI:

```
supabase/migrations/0001_schema.sql          tabelas e a constraint de exclusão
supabase/migrations/0002_seed.sql            barbearia, barbeiros, serviços, expediente
supabase/migrations/0003_reserva.sql         reservar, cancelar e os jobs
supabase/migrations/0004_acesso.sql          RLS e as funções com escopo por papel
supabase/migrations/0005_grants.sql          usage no schema app (senão nada insere)
supabase/migrations/0006_expediente.sql      horário real da casa
supabase/migrations/0007_clube_ilimitado.sql clube sem limite de cortes
supabase/migrations/0008_papel_cliente.sql   papel 'client' no enum
supabase/migrations/0009_chave_cliente.sql   chave de acesso do assinante
supabase/migrations/0010_area_cliente.sql    funções da área do clube
```

Um arquivo por vez importa da 0008 para a 0009: o Postgres só aceita escrever
`'client'` depois que o valor do enum estiver comitado, e o SQL Editor roda cada
arquivo numa transação.

Depois gere o token do Johny e guarde o que aparecer:

```bash
npm run token:owner
npm run dev
```

### Variáveis

| Variável | Para quê |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | endereço do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key (`sb_secret_...`), só no servidor |
| `SESSION_SECRET` | assina o cookie de sessão |
| `CRON_SECRET` | protege as rotas de cron |
| `NEXT_PUBLIC_BARBEARIA_SLUG` | qual barbearia este deploy atende |

## Chaves de acesso

**Token do Johny (owner).** `npm run token:owner` imprime o código uma única vez
e guarda só o hash. Rodar de novo **regera**: o token anterior é revogado na
hora e as sessões abertas caem. É também o caminho de recuperação — se ele
perder a chave, é só rodar outra vez. Não há fluxo de e-mail.

**Chave do barbeiro.** O Johny gera pela tela Equipe, no painel. A chave aparece
uma vez, com botão de copiar. No banco fica só o hash e os 4 primeiros dígitos,
para a lista mostrar mascarado com o último acesso de cada um. Revogar derruba a
sessão no próximo clique, porque toda requisição relê a linha em `access_keys`.

O alfabeto da chave não tem `O`, `I`, `0` nem `1` — são os quatro caracteres que
fazem alguém digitar errado quando lê em voz alta no WhatsApp.

Entrada em `/entrar`, um campo só. O erro é sempre o mesmo texto, dê o que der:
mensagem diferente por caso conta para quem está tentando adivinhar. Rate limit
de 5 tentativas por IP a cada 15 minutos, com registro em `login_attempts`.

## Como o banco sabe quem está pedindo

Projetos novos da Supabase assinam JWT com chave assimétrica e não entregam a
chave privada, então o servidor não tem como forjar um token que o PostgREST
leia. A identidade entra como **argumento**: o id da chave de acesso, que vive
no cookie httpOnly e nunca passa pelo JavaScript da página.

As funções de `0004_acesso.sql` derivam o barbeiro da própria chave e **ignoram
qualquer `barber_id` que o chamador mande**:

```sql
if s.papel = 'barber' then
  v_escopo := s.barbeiro_id;   -- só a si mesmo, dê o que der no p_barbeiro
else
  v_escopo := p_barbeiro;
end if;
```

Isso importa para o caso perigoso: **o barbeiro tem chave válida**. Se ele
forçar o id de outro na URL ou na query, quem barra é o Postgres, não a tela.

O RLS fica ligado e **sem policy nenhuma**, de propósito: se a publishable key
vazar, toda tabela responde vazio. Todo acesso real passa pelo servidor Next,
com a secret key, e pelas funções acima.

```bash
npm run teste:rls    # prova as três garantias contra o banco de verdade
```

## Concorrência

Dois clientes tocando o mesmo horário ao mesmo tempo é resolvido no banco, não
na tela: `appointments` tem uma constraint de exclusão GiST que proíbe dois
intervalos vivos se sobreporem para o mesmo barbeiro. O segundo insert falha, a
função traduz para `horario_ocupado` e a grade recarrega.

`public.reservar` revalida tudo — expediente, pausa, feriado, horário no
passado, crédito do clube — mesmo que a tela já tenha conferido.

## Pix

BR Code montado aqui mesmo, no padrão EMV do Banco Central, com CRC16 próprio.
Sem serviço pago. A chave é o celular do Johny (`84999835180`), titular
**Johny Rodrigues Gomes**, e cada agendamento gera um `txid` próprio com o valor
exato, para ele identificar no extrato.

```bash
npm run teste:pix    # confere o CRC contra o vetor padrão e o payload gerado
```

**A confirmação é sempre humana.** O painel mostra o bloco "Pix para conferir"
com "Recebi" e "Não caiu". Não existe botão de "já enviei o pix" na tela do
cliente — a palavra do cliente não confirma nada.

`barbershops.pagamento_modalidade` decide o comportamento:

- `opcional` — o agendamento já nasce `confirmado` e o pix é oferecido
- `obrigatorio` — nasce `pendente_pagamento` e segura o slot por
  `reserva_minutos` (padrão 15); o cron devolve à grade quando expira

Quem já faltou três vezes cai em `pendente_pagamento` de qualquer jeito.

### Trocar o provedor de pagamento

Tudo que sabe criar e confirmar cobrança está em `lib/payments/provider.ts`,
atrás da interface `ProvedorPagamento` (`criarCobranca`, `consultarStatus`,
`webhook`). Para plugar um PSP com confirmação automática, escreva outro objeto
com essa interface e devolva ele em `provedorAtual()`. O resto do sistema não
muda: ninguém fora desse arquivo sabe como a cobrança nasce.

## Clube

Cobrança manual, sem recorrência e sem cartão. O Johny recebe por pix ou
dinheiro e registra no painel, o que empurra `ciclo_fim` e `proxima_cobranca` em
um mês. Assinatura que passa da data vira `vencida` sozinha pelo cron e entra na
lista de cobrança. O botão de cobrar só monta a mensagem do WhatsApp.

Crédito usado fica em `subscription_uses` e **volta** se o agendamento for
cancelado — desistir não pode custar corte.

## Notificações

Fila em `notifications`, adaptador em `lib/notify/whatsapp.ts`. Sem API oficial
configurada, o painel mostra a fila com link `wa.me` e o texto pronto: o Johny
dispara em um clique. O sistema funciona inteiro sem integração paga.

## Crons (Vercel)

| Rota | Quando | O que faz |
| --- | --- | --- |
| `/api/cron/expirar-pix` | a cada minuto | devolve à grade o pix vencido |
| `/api/cron/lembretes` | de hora em hora | enfileira lembrete e vence assinatura |

Ambas exigem `Authorization: Bearer $CRON_SECRET`.

## Estrutura

```
app/entrar             entrada por chave, sem e-mail
app/agendar            fluxo do cliente em 5 passos
app/painel             painel do Johny (owner)
app/agenda             painel do barbeiro, só a agenda dele
app/api/cron           jobs protegidos por segredo
lib/auth               geração/hash de chave e sessão em cookie
lib/supabase           clients e o JWT de contexto que alimenta o RLS
lib/agenda             disponibilidade no servidor
lib/pix                BR Code EMV + CRC16
lib/payments           provedor de pagamento isolado
lib/notify             fila e texto das mensagens
supabase/migrations    schema, seed e funções transacionais
```

## Fora de escopo nesta versão

Login por e-mail e senha, recuperação por e-mail, cobrança recorrente
automática, cartão de crédito, cálculo de comissão por barbeiro e app nativo.
