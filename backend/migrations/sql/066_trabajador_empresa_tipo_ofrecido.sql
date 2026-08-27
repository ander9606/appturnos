-- 066 — Tipo de vínculo ofrecido al invitar por cédula.
-- 'nomina' implica exclusividad: al aceptar, el trabajador cambia su rol
-- global a trabajador_nomina y sus demás vínculos activos se archivan
-- (ver TrabajadorEmpresaService.aceptar).

ALTER TABLE trabajador_empresa
  ADD COLUMN tipo_ofrecido ENUM('turnos','nomina') NOT NULL DEFAULT 'turnos'
    COMMENT 'Track ofrecido al invitar. nomina = exclusivo a esta empresa.'
    AFTER iniciado_por;
