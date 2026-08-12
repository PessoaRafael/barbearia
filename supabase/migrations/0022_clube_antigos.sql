-- O plano dos clientes antigos, que atende até sábado.
--
-- O Johny fechou os planos novos de segunda a quinta, mas quem já era do clube
-- antes disso continua podendo marcar a semana inteira. Em vez de abrir
-- exceção no código, vira outro plano: a regra dos dias já mora na tabela, e
-- assim `reservar` não precisa saber que "antigo" existe.
--
-- Nasce inativo de propósito. Inativo não some para quem já assina — a reserva
-- lê o plano pelo id da assinatura — mas some da vitrine e da lista que o
-- Johny usa para cadastrar. Ou seja: continua valendo para os oito, e não é
-- vendido para mais ninguém.

insert into club_plans (
  barbershop_id, slug, nome, preco_centavos,
  cobre_categorias, dias_semana, ativo, ordem
)
select b.id,
       'corte_barba_antigos',
       'Corte + Barba ilimitado',
       18999,
       array['Cortes', 'Barba'],
       '{1,2,3,4,5,6}'::int[],   -- segunda a sábado; domingo a casa fecha
       false,
       9
  from barbershops b
 where b.slug = 'johny-barbearia'
on conflict (barbershop_id, slug) do update
   set dias_semana = excluded.dias_semana,
       cobre_categorias = excluded.cobre_categorias,
       preco_centavos = excluded.preco_centavos,
       ativo = false;
