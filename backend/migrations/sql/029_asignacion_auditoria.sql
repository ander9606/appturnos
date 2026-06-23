-- Auditoría de acciones de gestores sobre asignaciones de turno.
-- Registra quién rechazó o canceló cada asignación y cuándo.
ALTER TABLE asignaciones_turno
  ADD COLUMN rechazado_por INT NULL,
  ADD COLUMN rechazado_at  TIMESTAMP NULL,
  ADD COLUMN cancelado_por INT NULL,
  ADD COLUMN cancelado_at  TIMESTAMP NULL;
