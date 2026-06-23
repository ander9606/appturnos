-- 026 — Datos de contacto de la empresa
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS descripcion VARCHAR(500) NULL AFTER nit,
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) NULL AFTER descripcion,
  ADD COLUMN IF NOT EXISTS telefono VARCHAR(30) NULL AFTER logo_url,
  ADD COLUMN IF NOT EXISTS email_empresa VARCHAR(200) NULL AFTER telefono,
  ADD COLUMN IF NOT EXISTS direccion VARCHAR(300) NULL AFTER email_empresa,
  ADD COLUMN IF NOT EXISTS acepta_postulaciones TINYINT DEFAULT 0 AFTER direccion;
