-- 026 — Datos de contacto de la empresa
ALTER TABLE empresas
  ADD COLUMN descripcion VARCHAR(500) NULL AFTER nit,
  ADD COLUMN logo_url VARCHAR(500) NULL AFTER descripcion,
  ADD COLUMN telefono VARCHAR(30) NULL AFTER logo_url,
  ADD COLUMN email_empresa VARCHAR(200) NULL AFTER telefono,
  ADD COLUMN direccion VARCHAR(300) NULL AFTER email_empresa,
  ADD COLUMN acepta_postulaciones TINYINT DEFAULT 0 AFTER direccion;
