-- ============================================================
-- 092 — Descripción de perfil del trabajador
-- Texto libre para que el trabajador cuente qué sabe hacer,
-- visible para las empresas al revisar su perfil.
-- ============================================================

ALTER TABLE trabajadores
  ADD COLUMN descripcion VARCHAR(500) AFTER cargo;
