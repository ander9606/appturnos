-- ============================================================
-- 090 — Ubicación libre por turno (ofertas_turno)
--
-- Hasta ahora "sin geofence" solo existía por cargo (cargos.tipo_geofence
-- = 'libre', ver 015_puntos_marcaje.sql) — útil para un grupo fijo de
-- trabajadores (ej. conductores), pero no seleccionable turno por turno.
-- Este flag vive en la oferta y, cuando está activo, gana sobre el
-- tipo_geofence del cargo (ver construirGeofenceInfo en
-- asignaciones.consultas.model.js): cualquier turno puntual que no tenga
-- un punto fijo (entregas, mandados, rutas variables, etc.) puede marcarse
-- como libre al crearlo, sin depender de a qué cargo esté asignado.
-- ============================================================

ALTER TABLE ofertas_turno
  ADD COLUMN ubicacion_libre TINYINT(1) NOT NULL DEFAULT 0 AFTER longitud;
