-- ============================================================
-- 020 — Expo Push Tokens (app móvil)
-- Un usuario puede tener varios tokens (varios dispositivos).
-- No requiere empresa_id: los trabajadores marketplace tienen empresa_id = null.
-- ============================================================

CREATE TABLE IF NOT EXISTS expo_push_tokens (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  usuario_id    INT NOT NULL,
  token         VARCHAR(255) NOT NULL COMMENT 'ExponentPushToken[...]',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY    uk_expo_token (token),
  CONSTRAINT    fk_expo_token_usuario FOREIGN KEY (usuario_id)
                  REFERENCES usuarios (id) ON DELETE CASCADE,
  INDEX         idx_expo_token_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
