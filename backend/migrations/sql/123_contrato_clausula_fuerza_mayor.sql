-- ============================================================
-- 123 — contratos_diarios.clausula_fuerza_mayor
--
-- El PDF del contrato se genera al descargarlo, con los datos de ese momento. Para que la cláusula de
-- fuerza mayor (compensación si el turno se cancela y la tarea no se realiza; pago según contrato si la
-- labor se realiza) NO aparezca de golpe en contratos que ya existen o que el trabajador ya firmó, solo la
-- llevan los contratos creados desde este cambio: 1 = el contrato nace con la cláusula. Los anteriores
-- quedan en 0 y su PDF no cambia.
-- ============================================================

ALTER TABLE contratos_diarios
  ADD COLUMN clausula_fuerza_mayor TINYINT(1) NOT NULL DEFAULT 0;
