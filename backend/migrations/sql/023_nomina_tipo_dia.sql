-- ============================================================
-- 023 — tipo_dia para registros diarios de nómina
--
-- Permite al gestor clasificar días especiales (descanso,
-- compensatorio, incapacidad, vacacion, licencia).
-- Los registros con tipo_dia != 'ordinario' no generan horas
-- computables en la liquidación.
-- ============================================================

ALTER TABLE registros_diarios
  ADD COLUMN tipo_dia ENUM(
    'ordinario', 'descanso', 'compensatorio',
    'incapacidad', 'vacacion', 'licencia'
  ) NOT NULL DEFAULT 'ordinario'
    COMMENT 'Clasificación del día asignada por el gestor.'
  AFTER novedad;
