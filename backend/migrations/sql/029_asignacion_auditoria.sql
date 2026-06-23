-- Auditoría de acciones de gestores sobre asignaciones de turno.
-- Registra quién rechazó o canceló cada asignación y cuándo.
ALTER TABLE asignaciones_turno
  ADD COLUMN IF NOT EXISTS rechazado_por INT NULL,
  ADD COLUMN IF NOT EXISTS rechazado_at  TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS cancelado_por INT NULL,
  ADD COLUMN IF NOT EXISTS cancelado_at  TIMESTAMP NULL;
