-- ============================================================
-- 007 — Suscripciones Web Push
-- Ref: APP-TURNOS-SPEC/04-PANTALLAS.md (Notificaciones push)
--
-- Cada fila es una suscripción push de un navegador/dispositivo.
-- Un usuario puede tener varias (varios dispositivos).
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  usuario_id INT NOT NULL,
  endpoint VARCHAR(512) NOT NULL COMMENT 'URL del servicio push del navegador',
  p256dh VARCHAR(255) NOT NULL COMMENT 'Clave pública de cifrado de la suscripción',
  auth VARCHAR(255) NOT NULL COMMENT 'Secreto de autenticación de la suscripción',
  user_agent VARCHAR(300) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_push_endpoint (endpoint),
  CONSTRAINT fk_push_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
  CONSTRAINT fk_push_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  INDEX idx_push_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
