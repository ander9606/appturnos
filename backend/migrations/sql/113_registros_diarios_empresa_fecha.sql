-- 113 — Índice (empresa_id, fecha) en registros_diarios
--
-- Los reportes agregan por empresa y rango de fechas (sin filtrar por
-- trabajador). La llave única uk_registro (empresa_id, trabajador_id, fecha)
-- no sirve para eso: tras empresa_id tendría que recorrer todos los trabajadores.
-- InnoDB crea el índice en línea (sin bloquear lecturas ni escrituras).
-- ============================================================

ALTER TABLE registros_diarios
  ADD INDEX idx_rd_empresa_fecha (empresa_id, fecha),
  ALGORITHM = INPLACE, LOCK = NONE;
