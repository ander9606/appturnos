-- 056: Ubicación GPS al reportar una novedad — permite mandar coordenadas
-- reales en el evento novedad.reportada hacia logiq360 (antes no existía
-- ninguna captura de ubicación en este flujo).
ALTER TABLE novedades
  ADD COLUMN latitud  DECIMAL(10, 8) NULL AFTER foto_b64,
  ADD COLUMN longitud DECIMAL(11, 8) NULL AFTER latitud;
