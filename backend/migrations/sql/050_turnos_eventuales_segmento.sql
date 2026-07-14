-- 050: Turnos eventuales — separa el período por segmento de trabajador.
-- 'nomina'  = trabajadores de nómina que hacen turnos recurrentes ocasionales → ciclo trimestral fijo.
-- 'turnos'  = personal de apoyo 100% turnos (sin nómina base) → sigue empresas.tipo_liquidacion.

ALTER TABLE periodos_turno_eventual
  DROP INDEX uq_empresa_periodo,
  MODIFY COLUMN tipo ENUM('mensual','quincenal','semanal','trimestral') NOT NULL DEFAULT 'mensual',
  ADD COLUMN segmento ENUM('nomina','turnos') NOT NULL DEFAULT 'nomina' AFTER empresa_id,
  ADD UNIQUE KEY uq_empresa_segmento_periodo (empresa_id, segmento, fecha_inicio);
