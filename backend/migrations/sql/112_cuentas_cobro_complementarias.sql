-- ============================================================
-- 112 — Cuentas de cobro complementarias
--
-- Una cuenta firmada es el valor ya cobrado de sus turnos (puede estar pagada),
-- así que si un turno cambia después (p. ej. un bono) no se reescribe: se genera
-- OTRA cuenta del mismo período y trabajador solo por la diferencia.
-- `secuencia` 1 = cuenta original; 2, 3… = complementarias.
-- La llave única pasa a incluir la secuencia (se agrega la nueva antes de quitar
-- la vieja porque la FK de periodo_id necesita un índice que la cubra).
-- ============================================================

ALTER TABLE cuentas_cobro
  ADD COLUMN secuencia TINYINT NOT NULL DEFAULT 1
    COMMENT '1 = cuenta original; 2+ = complementarias por diferencia' AFTER trabajador_id,
  ADD UNIQUE KEY uk_cuenta_periodo_trabajador_seq (periodo_id, trabajador_id, secuencia),
  DROP INDEX uk_cuenta_periodo_trabajador;
