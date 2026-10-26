-- Pix e cartão pela InfinitePay.
--
-- O pix de hoje cai direto na chave do Johny e só confirma quando ele confere
-- o extrato e toca em "Recebi". Pix pago de noite fica esperando até ele
-- acordar, e a reserva vence antes: em 16/10 o horário do Rafael ia expirar à
-- 00h41 com o dinheiro já na conta. A InfinitePay avisa sozinha quando o pix
-- ou o cartão passa, e o horário confirma sem ninguém conferir nada.
--
-- A cobrança dela ganha método próprio por um motivo só: a aba "Pix a
-- conferir" do painel lista o método 'pix' esperando o Johny. Cobrança da
-- InfinitePay confirma sozinha; se aparecesse ali, um "Não caiu" tocado no
-- meio do pagamento cancelaria o horário de quem está pagando. Foi assim que o
-- Iuri perdeu a cadeira, com um cartão abandonado aparecendo na aba de pix.
--
-- Rodar ANTES do push: o código novo grava esse método. Se subir antes, a
-- cobrança da InfinitePay falha ao gravar e o cliente cai no pix de sempre.

alter type app.metodo_pagamento add value if not exists 'infinitepay';
