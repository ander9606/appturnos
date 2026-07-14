-- ============================================================
-- 051 — Encargado en el punto de trabajo
--
-- El trabajador que acepta un turno no tenía forma de saber a quién
-- buscar o llamar al llegar al lugar. Se agrega un contacto opcional
-- por oferta (no por punto_marcaje: la mayoría de turnos son eventos
-- puntuales sin punto fijo asociado).
-- ============================================================

ALTER TABLE ofertas_turno
  ADD COLUMN encargado_nombre VARCHAR(150) NULL AFTER lugar,
  ADD COLUMN encargado_telefono VARCHAR(20) NULL AFTER encargado_nombre;
