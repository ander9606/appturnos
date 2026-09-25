-- Preserva cada sesión cerrada del día (jornada partida por reingreso) para
-- poder mostrarlas todas en el detalle del registro. Hasta ahora solo se
-- guardaba la primera entrada (hora_entrada_inicial) y la sesión vigente
-- (hora_entrada/hora_salida) — la salida de la sesión anterior a un reingreso
-- se perdía al reescribirse. sesiones_detalle acumula esas sesiones cerradas;
-- junto con hora_entrada/hora_salida (la sesión actual) se reconstruye el día completo.

ALTER TABLE registros_diarios
  ADD COLUMN sesiones_detalle JSON NULL AFTER hora_entrada_inicial;
