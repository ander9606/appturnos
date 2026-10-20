-- ============================================================
-- 112 — Datos legales para el contrato de prestación de servicios
-- Representante legal de la empresa (antes no se guardaba en ningún
-- lado) y dirección de residencia del trabajador (antes solo la
-- empresa tenía dirección) — ambos se usan para completar el
-- contrato con cláusulas legales (ver contratoPdf.js y mobile
-- contrato/[id].tsx).
-- ============================================================

ALTER TABLE empresas
  ADD COLUMN representante_nombre VARCHAR(150) NULL AFTER nit,
  ADD COLUMN representante_cedula VARCHAR(20) NULL AFTER representante_nombre;

ALTER TABLE trabajadores
  ADD COLUMN direccion VARCHAR(300) NULL AFTER numero_cuenta;
