-- ============================================================
-- 016b — tipo_marcacion para trabajadores de nómina
--
-- Permite al admin definir si un trabajador puede marcar
-- desde cualquier lugar (libre) o debe estar en su punto
-- de marcaje asignado (fijo).
-- ============================================================

-- ponytail: idempotente — columnas pre-existían en algunos entornos
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME  = 'trabajadores'
    AND COLUMN_NAME = 'tipo_marcacion'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE trabajadores ADD COLUMN tipo_marcacion ENUM(''libre'',''fijo'') NOT NULL DEFAULT ''libre'', ADD COLUMN punto_marcaje_id INT NULL, ADD CONSTRAINT fk_trabajador_punto FOREIGN KEY (punto_marcaje_id) REFERENCES puntos_marcaje(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
