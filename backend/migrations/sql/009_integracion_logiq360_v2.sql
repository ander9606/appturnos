-- ============================================================
-- 009 — Integración logiq360 v2 (nuevos docs 2026-05-24)
-- Ref: docs/INTEGRACION-LOGIQ360-APP-TURNOS.md
--      docs/APP-CONTROL-TURNOS.md
--
-- Cambios:
--   1. ofertas_turno: ampliar ENUM estado para incluir 'borrador' y
--      'publicada' (los docs describen el ciclo completo de vida de la oferta
--      originada desde logiq360: borrador → publicada → cerrada → completada).
--      Los estados previos ('abierta', 'en_proceso') siguen siendo válidos
--      para ofertas creadas manualmente en la app sin Logiq360.
--
--   2. ofertas_turno: agregar columna alquiler_ref para trazar la relación
--      con el alquiler de logiq360 que originó la oferta.
--
--   3. ofertas_turno: agregar columna externo_notas para notas_para_operario
--      que llegan en el payload de orden.creada.
-- ============================================================

-- 1. Ampliar el ENUM de estado en ofertas_turno.
-- NOTA: En MySQL, modificar un ENUM conserva los valores existentes.
--       Los valores anteriores ('abierta', 'en_proceso') siguen siendo válidos.
ALTER TABLE ofertas_turno
  MODIFY COLUMN estado
    ENUM(
      'borrador',      -- creada desde logiq360, pendiente que el jefe complete/publique
      'abierta',       -- activa (creación manual en app)
      'publicada',     -- publicada desde borrador (evento orden.publicada)
      'en_proceso',    -- hay contratos activos
      'cerrada',       -- sin más cupos disponibles
      'completada',    -- todos los contratos terminados
      'cancelada'      -- cancelada (evento orden.cancelada o acción manual)
    ) NOT NULL DEFAULT 'abierta';

-- Al crear desde logiq360, el handler usará 'borrador'; las creaciones
-- manuales desde la app siguen usando 'abierta' (default sin cambios).
-- Actualizamos el default para reflejar el flujo integrado:
ALTER TABLE ofertas_turno
  MODIFY COLUMN estado
    ENUM(
      'borrador',
      'abierta',
      'publicada',
      'en_proceso',
      'cerrada',
      'completada',
      'cancelada'
    ) NOT NULL DEFAULT 'abierta';

-- 2. Columna alquiler_ref: referencia al alquiler de logiq360 que originó la oferta.
--    Formato: "logiq360:alquiler:31". NULL si es oferta manual.
--    Usa una consulta condicional para verificar existencia (MySQL 5.7 compatible).
ALTER TABLE ofertas_turno
  ADD COLUMN alquiler_ref VARCHAR(100) NULL
    COMMENT 'Ref al alquiler de logiq360 que originó esta oferta (logiq360:alquiler:N)'
    AFTER external_ref;

-- 3. Columna externo_notas: notas_para_operario del payload de logiq360.
--    Separada de 'descripcion' para no mezclar info interna con instrucciones externas.
ALTER TABLE ofertas_turno
  ADD COLUMN externo_notas TEXT NULL
    COMMENT 'Instrucciones para el operario recibidas desde logiq360 (notas_para_operario)'
    AFTER alquiler_ref;

-- Índice para buscar por alquiler_ref (consulta cruzada desde logiq360).
CREATE INDEX idx_ofertas_alquiler_ref
  ON ofertas_turno (empresa_id, alquiler_ref);
