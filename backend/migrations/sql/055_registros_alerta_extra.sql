-- ============================================================
-- 055 — Flag de alerta de horas extra ya enviada
--
-- Evita que el worker de horas extra reenvíe la misma notificación
-- en cada tick mientras el trabajador sigue en jornada.
-- ============================================================

ALTER TABLE registros_diarios
  ADD COLUMN alerta_extra_enviada TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Evita reenviar la notificación de "entró a horas extra" en cada tick del worker'
    AFTER hora_salida;
