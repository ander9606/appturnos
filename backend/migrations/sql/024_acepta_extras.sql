-- Migration 024: acepta_extras flag for trabajador_nomina
-- Allows nomina workers to opt-in to shift marketplace extras.

ALTER TABLE trabajadores
  ADD COLUMN acepta_extras TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Trabajador nómina acepta turnos extra del marketplace (opt-in).'
  AFTER salario_base;
