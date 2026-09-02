-- Clean up duplicate empty periods created by the Aug 31 race condition bug
-- (autoCrear() sin lock: dos workers marcando entrada a la vez creaban 2+
-- períodos idénticos). Borra SOLO el/los duplicado(s) de un grupo con mismas
-- fechas — nunca un período "vacío" legítimo que sea el único con esas fechas
-- (ej. recién auto-creado, todavía sin marcajes). Tampoco toca un duplicado que
-- ya tenga algo enganchado (descuento o compensatorio) — descansos_compensatorios
-- y descuentos_nomina tienen ON DELETE CASCADE hacia periodo_id, así que borrar
-- a ciegas por "sin registros_diarios" se llevaba esos datos con él.
-- Idempotente: una vez sin duplicados vacíos, no borra nada.
-- La subconsulta va envuelta en una derived table (subquery-en-FROM) porque
-- MySQL no permite leer y borrar de la misma tabla en la misma sentencia
-- ("You can't specify target table 'pn' for update in FROM clause").
DELETE FROM periodos_nomina
WHERE id IN (
  SELECT id FROM (
    SELECT pn.id
    FROM periodos_nomina pn
    JOIN periodos_nomina pn2
      ON pn2.empresa_id   = pn.empresa_id
     AND pn2.fecha_inicio = pn.fecha_inicio
     AND pn2.fecha_fin    = pn.fecha_fin
     AND pn2.id           < pn.id
    WHERE NOT EXISTS (SELECT 1 FROM registros_diarios rd WHERE rd.periodo_id = pn.id)
      AND NOT EXISTS (SELECT 1 FROM descansos_compensatorios dc WHERE dc.periodo_id = pn.id)
      AND NOT EXISTS (SELECT 1 FROM descuentos_nomina dn WHERE dn.periodo_id = pn.id)
  ) AS duplicados_vacios
);
