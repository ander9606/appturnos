-- ============================================================
-- 116 — refresh_tokens guarda el hash, no el token en texto plano
-- Un token robado de un backup o de una fuga de la base de datos ya no
-- sirve para hacerse pasar por el usuario: hay que presentar el token
-- original, que solo conoce quien lo recibió al hacer login.
-- Backfill antes de dropear la columna vieja: las sesiones ya activas
-- siguen sirviendo (su token no cambia, solo cómo se guarda/compara).
-- ============================================================

ALTER TABLE refresh_tokens ADD COLUMN token_hash CHAR(64) NULL AFTER token;
UPDATE refresh_tokens SET token_hash = SHA2(token, 256);
ALTER TABLE refresh_tokens MODIFY COLUMN token_hash CHAR(64) NOT NULL;
ALTER TABLE refresh_tokens DROP INDEX uk_refresh_token;
ALTER TABLE refresh_tokens ADD UNIQUE KEY uk_refresh_token_hash (token_hash);
ALTER TABLE refresh_tokens DROP COLUMN token;
