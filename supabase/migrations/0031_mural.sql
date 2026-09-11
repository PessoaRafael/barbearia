-- O mural da bancada.
--
-- O Johny vai deixar um tablet ligado numa tela só, e ninguém quer ficar
-- desbloqueando celular no meio do corte. Então precisa de um endereço que
-- abre direto, fica aberto o dia todo e se atualiza sozinho.
--
-- E precisa ser cego para o resto: tablet em bancada fica à vista de quem
-- espera, e ali não pode aparecer preço, caixa, telefone de cliente nem a
-- lista de assinantes. Por isso um endereço próprio, e não o painel com
-- alguma aba escondida — quem pega o tablet não pode chegar no dinheiro.

alter table barbershops
  add column if not exists mural_token text;

create unique index if not exists mural_token_unico
  on barbershops (mural_token)
  where mural_token is not null;

-- Nasce com um token difícil de adivinhar. Trocar o valor derruba o tablet e
-- é assim que se "revoga" o mural, se um dia o endereço vazar.
update barbershops
   set mural_token = encode(gen_random_bytes(16), 'hex')
 where mural_token is null;
