-- Índices de rendimiento en asignaciones_turno.
-- Las queries más frecuentes filtran por trabajador_id+estado (marcaje ingreso/egreso)
-- y por empresa_id+estado (listados de gestores). Sin estos índices MySQL hace full-scan
-- conforme la tabla crece.

ALTER TABLE asignaciones_turno
  ADD INDEX idx_at_trabajador_estado (trabajador_id, estado),
  ADD INDEX idx_at_empresa_estado    (empresa_id, estado);
