-- Migración 027: mapeo explícito tenant_id (logiq360) ↔ empresa_id (App Turnos)
-- Antes el receptor de webhooks asumía empresa_id == tenant_id del payload.
-- El emparejamiento (pairing) ahora persiste el tenant_id real de logiq360 para
-- enrutar los webhooks sin acoplar los IDs.

-- ponytail: idempotente vía information_schema — columnas pre-existían en algunos entornos
SET @col_tenant = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'integracion_config'
    AND COLUMN_NAME  = 'logiq360_tenant_id'
);
SET @ddl_tenant = IF(@col_tenant = 0,
  'ALTER TABLE integracion_config ADD COLUMN logiq360_tenant_id INT NULL COMMENT ''tenant_id en logiq360 — establecido por el emparejamiento'' AFTER empresa_id',
  'SELECT 1'
);
PREPARE stmt FROM @ddl_tenant;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_url = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'integracion_config'
    AND COLUMN_NAME  = 'logiq360_base_url'
);
SET @ddl_url = IF(@col_url = 0,
  'ALTER TABLE integracion_config ADD COLUMN logiq360_base_url VARCHAR(500) NULL COMMENT ''URL base de logiq360 para consultas pull'' AFTER webhook_url',
  'SELECT 1'
);
PREPARE stmt FROM @ddl_url;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Índice idempotente vía information_schema
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'integracion_config'
    AND INDEX_NAME   = 'idx_integracion_logiq360_tenant'
);
SET @ddl_idx = IF(@idx_exists = 0,
  'CREATE INDEX idx_integracion_logiq360_tenant ON integracion_config (logiq360_tenant_id)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
