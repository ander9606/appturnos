-- ============================================================
-- 077 — Marcaje sospechoso en turnos (asignaciones_turno)
--
-- Mismo mecanismo que 075/076 en nómina, aplicado a marcarIngreso de
-- asignaciones_turno — el otro sistema de marcaje que quedó sin cubrir
-- (turnos vs. nómina son módulos y roles distintos). marcarEgreso no
-- captura GPS hoy (solo firma), así que queda fuera de este chequeo.
-- ============================================================

ALTER TABLE asignaciones_turno
  ADD COLUMN device_ingreso VARCHAR(64) NULL AFTER longitud_ingreso,
  ADD COLUMN sospechoso TINYINT(1) NOT NULL DEFAULT 0 AFTER device_ingreso;
