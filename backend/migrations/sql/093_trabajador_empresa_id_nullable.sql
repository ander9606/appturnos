-- ============================================================
-- 093 — empresa_id nullable en trabajadores
-- Permite crear la ficha de perfil de un trabajador_turnos ANTES
-- de que se vincule a ninguna empresa (registro libre marketplace).
-- Esa ficha "personal" (empresa_id IS NULL) se reclama (se le asigna
-- empresa_id) al vincularse a su primera empresa, sin duplicar datos.
-- ============================================================

ALTER TABLE trabajadores
  MODIFY COLUMN empresa_id INT NULL;
