-- Migración 039: suscripciones por empresa
-- NULL en suscripcion_vigente_hasta = acceso indefinido (logiq360 o super_admin manual).
-- El origen registra cómo se activó la suscripción para auditoría.

SET @col1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'empresas' AND COLUMN_NAME = 'suscripcion_vigente_hasta');
SET @ddl1 = IF(@col1 = 0,
  'ALTER TABLE empresas ADD COLUMN suscripcion_vigente_hasta DATE NULL AFTER plan',
  'SELECT 1');
PREPARE stmt FROM @ddl1; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'empresas' AND COLUMN_NAME = 'suscripcion_origen');
SET @ddl2 = IF(@col2 = 0,
  'ALTER TABLE empresas ADD COLUMN suscripcion_origen ENUM(''manual'',''wompi'',''logiq360'') NOT NULL DEFAULT ''manual'' AFTER suscripcion_vigente_hasta',
  'SELECT 1');
PREPARE stmt FROM @ddl2; EXECUTE stmt; DEALLOCATE PREPARE stmt;
