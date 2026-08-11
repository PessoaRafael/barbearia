-- O chat vira uma origem própria.
--
-- O bot chama a mesma função do site, e o site grava 'link'. Resultado: todo
-- agendamento nascia como se tivesse vindo do formulário, e não havia como
-- responder "o Gilberto marcou pelo chat ou pelo site?".
--
-- Sozinha no arquivo pelo mesmo motivo da 0008: o Postgres não deixa escrever
-- um valor de enum na mesma transação em que ele foi criado.

alter type app.origem_agendamento add value if not exists 'chat';
