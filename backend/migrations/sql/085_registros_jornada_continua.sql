-- ============================================================
-- 085 — Jornada continua (sin hora de almuerzo)
--
-- Por defecto, calcularHoras() descuenta 1h de almuerzo cuando la jornada
-- supera 6h continuas (Art. 167 CST). Este flag permite al trabajador
-- marcarlo al cerrar su turno cuando NO tomó almuerzo, para que el
-- descuento automático no se le aplique ese día.
-- ============================================================

ALTER TABLE registros_diarios
  ADD COLUMN jornada_continua TINYINT(1) NOT NULL DEFAULT 0 AFTER tipo_dia;
