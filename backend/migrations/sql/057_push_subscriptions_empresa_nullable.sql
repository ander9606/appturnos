-- ============================================================
-- 057 — push_subscriptions.empresa_id nullable
--
-- Los trabajadores marketplace (trabajador_turnos multi-empresa) tienen
-- empresa_id = null en su JWT (ver expo_push_tokens, migracion 020, que ya
-- resolvio esto para el token de Expo). push_subscriptions se quedo con
-- empresa_id NOT NULL, asi que un intento de suscripcion Web Push desde
-- esa poblacion violaria la restriccion NOT NULL. Se deja nullable para
-- que el mismo caso no rompa este camino si algun cliente llega a usarlo.
-- ============================================================

ALTER TABLE push_subscriptions
  MODIFY empresa_id INT NULL;
