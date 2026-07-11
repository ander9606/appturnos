-- ============================================================
-- 048 — Distingue pagos rechazados de otros eventos ignorados
--
-- Antes, un pago DECLINED/VOIDED/ERROR caía en el mismo estado
-- 'ignorado' que un evento de Wompi irrelevante (ej. transaction.created).
-- Con un estado propio se puede filtrar en el panel y disparar
-- notificación a la empresa afectada.
-- ============================================================

ALTER TABLE wompi_eventos
  MODIFY COLUMN estado ENUM('recibido','procesado','error','ignorado','rechazado') NOT NULL DEFAULT 'recibido';
