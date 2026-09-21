-- ============================================================
-- 097 — tipo_dia 'ausencia' para registros diarios de nómina
--
-- Permite al gestor marcar un día en el que el trabajador no se
-- presentó sin justificación (falta), sin necesidad de una hora
-- de entrada. No genera horas computables, igual que el resto de
-- tipo_dia distintos de 'ordinario'.
-- ============================================================

ALTER TABLE registros_diarios
  MODIFY COLUMN tipo_dia ENUM(
    'ordinario', 'descanso', 'compensatorio',
    'incapacidad', 'vacacion', 'licencia', 'ausencia'
  ) NOT NULL DEFAULT 'ordinario'
    COMMENT 'Clasificación del día asignada por el gestor.';
