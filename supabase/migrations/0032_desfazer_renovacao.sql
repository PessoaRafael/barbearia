-- Desfazer a renovação que foi sem querer.
--
-- "Recebi o mês" e "Renovar" são um toque só, ficam do lado de outros botões
-- e o Johny mexe no painel com a máquina na mão. No dia 18 ele encostou no do
-- Bruno Ribeiro, que só vence dia 21: o ciclo pulou para 18/10 e a cobrança
-- de R$ 189,99 sumiu da tela de vencendo. Não existia nada no sistema para
-- voltar atrás, e ele só percebeu dois dias depois.
--
-- A saída é guardar o ciclo de antes na própria assinatura. É um passo só
-- para trás, que é o que resolve o erro de dedo — histórico de renovação é
-- outro assunto, e tabela nova para isso seria peso sem uso.

alter table subscriptions
  -- O ciclo que valia antes do último "Recebi". Nulo quer dizer que não tem o
  -- que desfazer: ou nunca renovou, ou já desfizeram.
  add column if not exists ciclo_anterior_inicio date,
  add column if not exists ciclo_anterior_fim date,
  -- O status vem junto porque vencida e ativa não se deduzem só da data: quem
  -- marca vencida é a rotina diária, e desfazer tem que devolver o que estava
  -- lá, não o que a data sugere.
  add column if not exists status_anterior app.status_assinatura,
  -- Quando renovou. Serve para a tela decidir se ainda mostra o desfazer:
  -- mês passado já virou dinheiro contado, e ali o botão só atrapalha.
  add column if not exists renovada_em timestamptz;
