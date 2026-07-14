-- 032: Turnos eventuales — el período ya no es fijo a trimestre.
-- Ahora sigue el mismo ciclo (mensual/quincenal/semanal) que empresas.tipo_liquidacion,
-- igual que la nómina regular.

ALTER TABLE periodos_turno_eventual
  DROP INDEX uq_empresa_trim,
  DROP COLUMN anio,
  DROP COLUMN trimestre,
  ADD COLUMN tipo ENUM('mensual','quincenal','semanal') NOT NULL DEFAULT 'mensual' AFTER empresa_id,
  ADD UNIQUE KEY uq_empresa_periodo (empresa_id, fecha_inicio);
