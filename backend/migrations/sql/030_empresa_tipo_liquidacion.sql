-- Ciclo de liquidación de nómina por empresa.
-- Determina cómo se crean automáticamente los períodos de nómina.
ALTER TABLE empresas
  ADD COLUMN tipo_liquidacion ENUM('mensual','quincenal','semanal')
    NOT NULL DEFAULT 'mensual';
