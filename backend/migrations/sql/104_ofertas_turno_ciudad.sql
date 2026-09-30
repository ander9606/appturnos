-- ============================================================
-- 104 — ofertas_turno.ciudad (derivada por geocodificación)
--
-- El directorio de empresas (trabajador_turnos buscando dónde
-- trabajar) filtraba solo por empresas.ciudad: un único valor
-- autoreportado por la empresa que no refleja que puede operar en
-- varias ciudades vía sus turnos (ej. sede en Bogotá, turnos en
-- Medellín). Esta columna guarda la ciudad resuelta a partir de
-- lat/lng de la oferta (best-effort, vía Nominatim — ver
-- ofertas.gestion.service.js geocodificarCiudadOferta) para que el
-- directorio también pueda encontrar la empresa por dónde
-- realmente publica turnos, no solo por su ciudad declarada.
-- ============================================================

ALTER TABLE ofertas_turno
  ADD COLUMN ciudad VARCHAR(100) NULL AFTER lugar;
