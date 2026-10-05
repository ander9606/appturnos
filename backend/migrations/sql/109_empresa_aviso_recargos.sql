-- Evidencia del aviso al pasar a "sin recargos": quién lo confirmó y cuándo (último cambio).
ALTER TABLE empresas
  ADD COLUMN aviso_recargos_aceptado_por INT NULL,
  ADD COLUMN aviso_recargos_aceptado_at DATETIME NULL;
