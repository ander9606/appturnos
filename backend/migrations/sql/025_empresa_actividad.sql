-- 025 — Agregar columna actividad a empresas
-- El admin_empresa puede registrar la actividad económica de su empresa.

ALTER TABLE empresas
  ADD COLUMN actividad VARCHAR(200) NULL
    COMMENT 'Actividad económica principal de la empresa'
    AFTER descripcion;
