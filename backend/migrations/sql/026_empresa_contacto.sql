-- 026 — Datos de contacto de la empresa
-- Idempotente: agrega cada columna solo si no existe (MySQL 8.0 compatible)
DROP PROCEDURE IF EXISTS _m026;
CREATE PROCEDURE _m026()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='empresas' AND COLUMN_NAME='descripcion') THEN
    ALTER TABLE empresas ADD COLUMN descripcion VARCHAR(500) NULL AFTER nit;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='empresas' AND COLUMN_NAME='logo_url') THEN
    ALTER TABLE empresas ADD COLUMN logo_url VARCHAR(500) NULL AFTER descripcion;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='empresas' AND COLUMN_NAME='telefono') THEN
    ALTER TABLE empresas ADD COLUMN telefono VARCHAR(30) NULL AFTER logo_url;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='empresas' AND COLUMN_NAME='email_empresa') THEN
    ALTER TABLE empresas ADD COLUMN email_empresa VARCHAR(200) NULL AFTER telefono;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='empresas' AND COLUMN_NAME='direccion') THEN
    ALTER TABLE empresas ADD COLUMN direccion VARCHAR(300) NULL AFTER email_empresa;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='empresas' AND COLUMN_NAME='acepta_postulaciones') THEN
    ALTER TABLE empresas ADD COLUMN acepta_postulaciones TINYINT DEFAULT 0 AFTER direccion;
  END IF;
END;
CALL _m026();
DROP PROCEDURE IF EXISTS _m026;
