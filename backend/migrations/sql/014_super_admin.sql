-- ============================================================
-- 014 — Soporte para rol super_admin
--
-- Cambios:
--   1. Hace empresa_id nullable en `usuarios` — el super_admin
--      opera a nivel de sistema (empresa_id = NULL).
--   2. Amplía el ENUM `rol` para incluir 'super_admin'.
-- ============================================================

-- 1. Permitir empresa_id NULL (mantiene la FK hacia empresas).
ALTER TABLE usuarios
  MODIFY COLUMN empresa_id INT NULL;

-- 2. Agregar 'super_admin' al ENUM de roles.
ALTER TABLE usuarios
  MODIFY COLUMN rol ENUM(
    'super_admin',
    'admin_empresa',
    'jefe_turnos',
    'jefe_nomina',
    'nomina',
    'trabajador_turnos',
    'trabajador_nomina'
  ) NOT NULL;
