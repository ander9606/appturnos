-- 064: bandera de idempotencia para el resumen diario al gestor
--
-- Evita que compensatorios.worker.js reenvíe el aviso de "hoy está de
-- compensatorio" en cada tick mientras la fecha_asignada siga siendo hoy.
-- Mismo patrón que registros_diarios.alerta_extra_enviada (055) y
-- ofertas_turno.cobertura_notificada (063).
ALTER TABLE descansos_compensatorios
  ADD COLUMN notificado_gestor TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Evita reenviar el resumen diario al gestor en cada tick del worker'
    AFTER fecha_asignada;
