-- ============================================================
-- 016 — tipo_marcacion para trabajadores de nómina
--
-- Permite al admin definir si un trabajador puede marcar
-- desde cualquier lugar (libre) o debe estar en su punto
-- de marcaje asignado (fijo).
-- ============================================================

ALTER TABLE trabajadores
  ADD COLUMN tipo_marcacion ENUM('libre','fijo') NOT NULL DEFAULT 'libre',
  ADD COLUMN punto_marcaje_id INT NULL,
  ADD CONSTRAINT fk_trabajador_punto FOREIGN KEY (punto_marcaje_id)
    REFERENCES puntos_marcaje(id) ON DELETE SET NULL;
