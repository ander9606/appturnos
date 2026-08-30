-- 065 — Columna dedicada para la API key que logiq360 presenta a Zaturno
--
-- BUG: emparejar() guardaba esa API key (generada localmente como
-- `appTurnosApiKey`) en `incoming_secret` — la misma columna que
-- verificarFirmaLogiq360 usa para validar el HMAC de los webhooks
-- entrantes (S_A, devuelto por logiq360 como `b.incoming_secret`). Como la
-- columna solo puede guardar un valor, esto rompía la verificación de firma
-- de TODO webhook entrante: siempre HTTP 401 "Firma del webhook inválida".
--
-- Con esta columna separada, incoming_secret vuelve a guardar exclusivamente
-- S_A, y logiq360_api_key guarda el valor que verificarApiKeyLogiq360 debe
-- comparar contra el header X-API-Key de las consultas pull.
ALTER TABLE integracion_config
  ADD COLUMN logiq360_api_key VARCHAR(255) NULL
    COMMENT 'API key que logiq360 presenta como X-API-Key al consultar los endpoints pull de Zaturno'
    AFTER logiq360_base_url;
