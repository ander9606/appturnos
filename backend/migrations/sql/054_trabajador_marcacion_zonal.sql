-- ============================================================
-- 054 — Marcación zonal para trabajadores de nómina
--
-- Antes solo podían marcar 'libre' (cualquier lugar) o 'fijo' (un único
-- punto asignado). Se agrega 'zonal': válido desde cualquiera de los
-- puntos_marcaje tipo='zonal' de la empresa — mismo concepto que ya
-- existe para cargos/turnos (asignaciones.service.js).
-- ============================================================

ALTER TABLE trabajadores
  MODIFY COLUMN tipo_marcacion ENUM('libre', 'fijo', 'zonal') NOT NULL DEFAULT 'libre';
