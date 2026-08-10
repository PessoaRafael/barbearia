-- Fotos da equipe.
--
-- Já aplicado no banco do Johny pela API de dados; fica aqui para um banco
-- novo, criado só a partir das migrations, nascer com as fotos no lugar.
--
-- Os arquivos vivem em public/, então a maiúscula importa: o Linux da Vercel
-- diferencia Johny.jpg de johny.jpg, o Windows não.

update barbers set foto_url = '/Johny.jpg'    where apelido = 'Johny';
update barbers set foto_url = '/Anderson.jpg' where apelido = 'Anderson';
update barbers set foto_url = '/Davi.jpg'     where apelido = 'Davi';
