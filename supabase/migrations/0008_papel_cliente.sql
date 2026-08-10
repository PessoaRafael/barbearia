-- O papel 'client', sozinho neste arquivo.
--
-- O Postgres recusa usar um valor de enum na mesma transação em que ele foi
-- adicionado ("unsafe use of new value"), e o editor de SQL do Supabase roda o
-- arquivo inteiro numa transação só. Por isso o valor entra aqui e quem
-- escreve 'client' fica na 0009, no arquivo seguinte.

alter type app.papel_acesso add value if not exists 'client';
