-- ============================================================
-- 069 — Cédula única por empresa
--
-- Evita 2 perfiles de trabajador con la misma cédula dentro de la MISMA
-- empresa (alta duplicada por error). No es única a nivel global porque
-- el flujo trabajador-empresa (vincularTrabajador/invitar) crea a propósito
-- una fila de `trabajadores` por empresa para la misma persona cuando
-- trabaja en varias — eso debe seguir funcionando.
--
-- cedula es NULL-able (perfiles sin documento aún) — MySQL permite
-- múltiples NULL en un UNIQUE, así que no hace falta manejo especial.
-- ============================================================

ALTER TABLE trabajadores
  ADD UNIQUE KEY uk_empresa_cedula (empresa_id, cedula);
