-- ============================================================
-- 005 — Integración con logiq360 (opcional, loose-coupled)
-- Ref: APP-TURNOS-SPEC/05-INTEGRACION.md, 03-API-ENDPOINTS.md
--
-- integration_events_out / integration_events_in replican la estructura
-- de la migración 57 de logiq360, adaptando el tenant: logiq360 usa
-- `tenant_id`→`tenants`; App Turnos usa `empresa_id`→`empresas`.
--
-- Las direcciones están espejadas respecto a logiq360, como es natural:
--   App Turnos.integration_events_out  → eventos App Turnos → logiq360
--   App Turnos.integration_events_in   → eventos logiq360  → App Turnos
-- ============================================================

-- Configuración de la integración por empresa. Sin fila activa, la
-- integración no emite ni recibe nada (App Turnos funciona standalone).
-- Es el espejo de `integraciones_turnos` en logiq360: aquí se guardan los
-- datos de conexión HACIA logiq360.
CREATE TABLE IF NOT EXISTS integracion_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 0,
  webhook_url VARCHAR(500) COMMENT 'Endpoint de logiq360 al que App Turnos emite eventos',
  webhook_secret VARCHAR(128) COMMENT 'Secreto HMAC-SHA256 para firmar eventos salientes',
  api_key VARCHAR(255) COMMENT 'API key que App Turnos presenta al llamar a logiq360',
  incoming_secret VARCHAR(128) COMMENT 'Secreto para verificar la firma de eventos entrantes',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_integracion_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE,
  UNIQUE KEY uk_integracion_empresa (empresa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cola de eventos salientes (App Turnos → logiq360).
-- Reintentos exponenciales: 0s → 30s → 2m → 10m → 1h (5 intentos máx).
CREATE TABLE IF NOT EXISTS integration_events_out (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  event_id CHAR(36) NOT NULL COMMENT 'UUID v4 — idempotency key para el receptor',
  tipo_evento VARCHAR(80) NOT NULL COMMENT 'trabajador.ingreso | trabajador.egreso | contrato.completado | etc.',
  payload JSON NOT NULL,
  estado ENUM('pendiente', 'enviado', 'fallido', 'descartado') NOT NULL DEFAULT 'pendiente',
  intentos INT NOT NULL DEFAULT 0,
  proximo_intento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_error TEXT NULL,
  enviado_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_events_out_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE,
  UNIQUE KEY uk_event_out_id (event_id),
  INDEX idx_events_out_pendientes (estado, proximo_intento),
  INDEX idx_events_out_empresa (empresa_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registro de eventos entrantes (logiq360 → App Turnos).
-- event_id UNIQUE garantiza idempotencia: rechaza reentregas duplicadas.
CREATE TABLE IF NOT EXISTS integration_events_in (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  event_id CHAR(36) NOT NULL COMMENT 'UUID del emisor — usado para deduplicación',
  tipo_evento VARCHAR(80) NOT NULL,
  payload JSON NOT NULL,
  estado ENUM('recibido', 'procesado', 'error') NOT NULL DEFAULT 'recibido',
  error_detalle TEXT NULL,
  procesado_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_events_in_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE,
  UNIQUE KEY uk_event_in_id (event_id),
  INDEX idx_events_in_empresa (empresa_id, created_at),
  INDEX idx_events_in_estado (estado, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
