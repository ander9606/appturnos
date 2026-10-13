-- ============================================================
-- 111 — asignaciones_turno.estado: nuevo valor 'fallido'
--
-- Cancelación de oferta por fuerza mayor (ver OfertasService.marcarFallida
-- en ofertas.gestion.service.js): a diferencia de 'cancelado', 'fallido'
-- solo aplica a asignaciones que ya estaban 'en_progreso' (el trabajador
-- ya había marcado ingreso) y conlleva compensación — pago_total se fija
-- al valor digitado por el gestor (por default, la tarifa_dia completa del
-- puesto, mismo criterio que registrarEgreso). Las demás asignaciones de
-- la oferta (confirmado/pendiente/por_reconfirmar) se cancelan como
-- siempre, sin compensación.
-- ============================================================

ALTER TABLE asignaciones_turno
  MODIFY estado ENUM('pendiente','confirmado','en_progreso','completado','no_presentado','cancelado','por_reconfirmar','fallido')
  DEFAULT 'pendiente',
  ADD COLUMN compensacion_motivo VARCHAR(255) NULL,
  ADD COLUMN fallido_por INT NULL,
  ADD COLUMN fallido_at  DATETIME NULL;
