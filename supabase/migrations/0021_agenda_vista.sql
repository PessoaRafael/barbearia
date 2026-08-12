-- Quando o Johny olhou a agenda pela última vez.
--
-- Com o pix confirmando sozinho, ele perdeu o motivo de abrir o painel: antes
-- precisava clicar em "Recebi", agora não precisa de nada. Sem um sinal, dá
-- para passar a tarde inteira sem saber que entraram quatro clientes.
--
-- Fica na chave de acesso, e não na barbearia, porque cada pessoa tem o seu
-- "já vi": o Johny olhar não pode apagar o aviso do barbeiro.

alter table access_keys
  add column if not exists agenda_vista_em timestamptz;

-- Quem já usa o sistema começa do zero em vez de levar um contador com todo o
-- histórico na cara no primeiro acesso depois da atualização.
update access_keys
   set agenda_vista_em = now()
 where revogada_em is null
   and agenda_vista_em is null;
