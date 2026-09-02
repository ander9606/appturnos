-- ============================================================
-- 075 — Flag de marcaje sospechoso (posible "buddy punching")
--
-- No bloquea el marcaje (el trabajador real no debe quedar sin poder
-- marcar por una sospecha) — solo lo marca para que jefe_turnos/
-- admin_empresa/nomina lo audite. Se calcula en registros.service.js:
-- otro trabajador de la misma empresa marcando (mismo tipo: entrada
-- con entrada, salida con salida) a pocos metros y pocos minutos de
-- distancia.
-- ============================================================

ALTER TABLE registros_diarios
  ADD COLUMN sospechoso TINYINT(1) NOT NULL DEFAULT 0 AFTER novedad;
