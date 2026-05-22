-- ============================================================
-- 005 — Integración con logiq360 (opcional, loose-coupled)
-- Ref: APP-TURNOS-SPEC/05-INTEGRACION.md, 03-API-ENDPOINTS.md
--
-- Nota: 02-BASE-DATOS.md indica que integration_events_* son "idénticas
-- en estructura a las de logiq360 (migración 57)". Esa migración no está
-- disponible en este repo, por lo que estas tablas se modelan a partir
-- del contrato descrito en 05-INTEGRACION.md (cola, reintentos, firma HMAC,
-- deduplicación por event_id).
-- ============================================================

-- Configuración de la integración por empresa. Sin fila activa, la
-- integración no emite ni recibe nada (App Turnos funciona standalone).
CREATE TABLE IF NOT EXISTS integracion_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  activo TINYINT DEFAULT 0,
  webhook_url VARCHAR(500),       -- endpoint de logiq360 al que se emite
  webhook_secret VARCHAR(255),    -- secreto HMAC para firmar eventos salientes
  api_key VARCHAR(255),           -- API key de App Turnos hacia logiq360
  incoming_secret VARCHAR(255),   -- secreto para verificar eventos entrantes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_integracion_empresa (empresa_id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB;

-- Cola de eventos salientes (App Turnos → logiq360).
-- Reintentos exponenciales: 0s → 30s → 2m → 10m → 1h (5 intentos máx).
CREATE TABLE IF NOT EXISTS integration_events_out (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  event_id CHAR(36) NOT NULL,     -- UUID v4
  tipo_evento VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  estado ENUM('pendiente','enviado','fallido') DEFAULT 'pendiente',
  intentos INT DEFAULT 0,
  proximo_intento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultimo_error TEXT NULL,
  enviado_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_event_out (event_id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  INDEX idx_out_cola (estado, proximo_intento)
) ENGINE=InnoDB;

-- Registro de eventos entrantes (logiq360 → App Turnos).
-- event_id UNIQUE deduplica reentregas del emisor.
CREATE TABLE IF NOT EXISTS integration_events_in (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  event_id CHAR(36) NOT NULL,     -- UUID v4
  tipo_evento VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  estado ENUM('recibido','procesado','fallido') DEFAULT 'recibido',
  procesado_at TIMESTAMP NULL,
  ultimo_error TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_event_in (event_id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB;
