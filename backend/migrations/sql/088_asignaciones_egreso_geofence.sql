-- ============================================================
-- 088 — Geofence en egreso de turnos (asignaciones_turno)
--
-- marcarEgreso nunca capturó GPS (ver nota en 077) -- solo pedía firma.
-- Ahora el egreso valida geofence igual que el ingreso (fijo/zonal/oferta
-- bloquean fuera de radio; libre sigue sin restricción). Se agregan las
-- columnas espejo de latitud_ingreso/longitud_ingreso.
-- ============================================================

ALTER TABLE asignaciones_turno
  ADD COLUMN latitud_egreso  DECIMAL(10,8) NULL AFTER sospechoso,
  ADD COLUMN longitud_egreso DECIMAL(11,8) NULL AFTER latitud_egreso;
