-- ============================================================
-- 125 — asignaciones_turno.compensacion_alerta_at
--
-- Cuando una propuesta de compensación (ver migración 124) lleva demasiado tiempo sin que el trabajador
-- responda, se le avisa UNA vez al gestor (turnos.worker.js → alertarCompensacionesSinResponder). Esta
-- marca guarda cuándo se avisó para no repetir el aviso en cada ciclo del worker. NULL = aún no se avisó.
-- ============================================================

ALTER TABLE asignaciones_turno
  ADD COLUMN compensacion_alerta_at DATETIME NULL;
