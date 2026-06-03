-- ============================================================
-- 017 — pago_extra en asignaciones_turno
--
-- Almacena el pago adicional generado por trabajar más allá
-- del horario estimado del turno (hora_fin_estimada).
-- pago_total sigue siendo la suma total; pago_extra permite
-- mostrar el desglose base + overtime al trabajador.
-- ============================================================

ALTER TABLE asignaciones_turno
  ADD COLUMN pago_extra DECIMAL(12,2) NOT NULL DEFAULT 0
    COMMENT 'Pago por horas trabajadas fuera del horario estimado del turno';
