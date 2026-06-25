-- 035 — Columna para guardar empresas que invitaron al trabajador antes de que active cuenta.
-- Cuando admin invita por cédula y el trabajador no tiene cuenta, aquí se registra el empresa_id
-- invitante. activarCuenta lo procesa para crear trabajador_empresa SOLICITADO_POR_EMPRESA.

ALTER TABLE trabajadores
  ADD COLUMN IF NOT EXISTS empresas_invitacion JSON NULL
    COMMENT 'IDs de empresas que invitaron (sin cuenta previa). Procesado en activarCuenta.'
    AFTER empresas_postulacion;
