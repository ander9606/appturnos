-- ============================================================
-- 121 — Nombre corto del lugar (lugar_alias)
--
-- `lugar` guarda la dirección completa que devuelve el buscador o el GPS
-- ("Corferias, Carrera 37, Quinta Paredes, Teusaquillo, Bogotá, ..., Colombia"):
-- es lo que necesitan el mapa y el contrato, pero no cabe en una tarjeta ni en
-- una línea del PDF de la cuenta de cobro. `lugar_alias` es un nombre corto
-- opcional ("Corferias") para las pantallas y documentos donde falta espacio.
--
-- Migración ADITIVA: columnas NULL. Los turnos y grupos actuales quedan en NULL
-- y se siguen mostrando como siempre. Re-ejecutable (cada ALTER va protegido).
-- Mismo tamaño en las dos tablas porque el lugar del grupo se copia a sus turnos.
-- ============================================================

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ofertas_turno' AND COLUMN_NAME = 'lugar_alias');
SET @ddl = IF(@col = 0,
  'ALTER TABLE ofertas_turno ADD COLUMN lugar_alias VARCHAR(80) NULL AFTER lugar',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grupos_turno' AND COLUMN_NAME = 'lugar_alias');
SET @ddl = IF(@col = 0,
  'ALTER TABLE grupos_turno ADD COLUMN lugar_alias VARCHAR(80) NULL AFTER lugar',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
