-- ============================================================
-- 122 — asignaciones_turno.fallido_aceptado_at
--
-- El trabajador confirma que se enteró de que su turno fue dado por
-- fallido (fuerza mayor) y de la compensación. Es solo un "enterado":
-- el pago NO espera esta aceptación (ver OfertasService.marcarFallida).
-- NULL = aún no lo ha aceptado.
-- ============================================================

ALTER TABLE asignaciones_turno
  ADD COLUMN fallido_aceptado_at DATETIME NULL AFTER fallido_at;
