-- ============================================================
-- 076 — Id de dispositivo por marcaje (nómina)
--
-- Complementa la sospecha de 075 (proximidad + tiempo): la proximidad sola
-- también matchea a dos compañeros reales marcando juntos en la puerta. Si
-- el device_id coincide entre dos trabajadores distintos, es una señal mucho
-- más fuerte (una sola app, dos cuentas) — ver revisarMarcajeSospechoso()
-- en registros.service.js. El móvil lo genera y guarda una vez en
-- SecureStore (apps/mobile/lib/deviceId.ts); no es un id de hardware.
-- ============================================================

ALTER TABLE registros_diarios
  ADD COLUMN device_entrada VARCHAR(64) NULL AFTER longitud_entrada,
  ADD COLUMN device_salida  VARCHAR(64) NULL AFTER longitud_salida;
