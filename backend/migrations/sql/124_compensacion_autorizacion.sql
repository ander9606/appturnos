-- ============================================================
-- 124 — Autorización del trabajador para bajarle el pago de un turno ya trabajado
--
-- Dar por fallido (fuerza mayor) un turno que el trabajador YA completó puede dejarle menos de lo que
-- ganó. Eso no se aplica solo: queda como una PROPUESTA y el trabajador la autoriza o no (ver
-- OfertasService.marcarFallida y AsignacionesService.autorizarCompensacion). Mientras no responda, el
-- turno sigue 'completado' pero EN ESPERA: no suma ni resta en liquidación, cuenta de cobro ni totales.
-- Si no autoriza, se paga según su contrato y vuelve a contar.
--
--   compensacion_propuesta      monto propuesto (sin bono; el pago final = propuesta + bono_monto)
--   compensacion_propuesta_por  usuario gestor que la propuso
--   compensacion_propuesta_at   cuándo se propuso
--   compensacion_pago_anterior  lo que pagaba el turno al proponer (constancia del antes: pago_total se reemplaza al autorizar)
--   compensacion_decision       'pendiente' | 'autorizada' | 'rechazada' (NULL = nunca hubo propuesta)
--   compensacion_decision_at    cuándo decidió el trabajador
-- ============================================================

ALTER TABLE asignaciones_turno
  ADD COLUMN compensacion_propuesta     DECIMAL(12,2) NULL,
  ADD COLUMN compensacion_propuesta_por INT NULL,
  ADD COLUMN compensacion_propuesta_at  DATETIME NULL,
  ADD COLUMN compensacion_pago_anterior DECIMAL(12,2) NULL,
  ADD COLUMN compensacion_decision      ENUM('pendiente','autorizada','rechazada') NULL,
  ADD COLUMN compensacion_decision_at   DATETIME NULL;
