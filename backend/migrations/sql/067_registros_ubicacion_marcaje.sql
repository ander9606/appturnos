-- ============================================================
-- 067 — Ubicación donde se marcó entrada/salida (nómina)
--
-- El geofence (validarGeofence en registros.service.js) ya recibe y valida
-- latitud/longitud al marcar — hasta ahora se descartaban después de validar.
-- Mismo patrón de columnas que latitud_ingreso/longitud_ingreso en
-- asignaciones_turno (migración 004), adaptado al vocabulario de nómina.
-- Quedan NULL para trabajadores con tipo_marcacion = 'libre' (no se les pide GPS).
-- ============================================================

ALTER TABLE registros_diarios
  ADD COLUMN latitud_entrada  DECIMAL(10, 8) NULL AFTER hora_entrada,
  ADD COLUMN longitud_entrada DECIMAL(11, 8) NULL AFTER latitud_entrada,
  ADD COLUMN latitud_salida   DECIMAL(10, 8) NULL AFTER hora_salida,
  ADD COLUMN longitud_salida  DECIMAL(11, 8) NULL AFTER latitud_salida;
