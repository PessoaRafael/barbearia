-- Expediente real da casa, corrigindo o que o seed chutou.
--
-- Isto não é enfeite: working_hours é a fonte da grade de horários. Com
-- 09:00–19:00 o site oferecia 8h30 como indisponível e 18h30 como livre,
-- os dois errados.
--
-- Segunda a sexta 08:30 às 18:30, sábado 08:30 às 17:30, domingo fechado
-- (domingo não tem linha nenhuma, então nunca gera slot).

update working_hours
   set abre = '08:30', fecha = '18:30'
 where dia_semana between 1 and 5;

update working_hours
   set abre = '08:30', fecha = '17:30'
 where dia_semana = 6;
