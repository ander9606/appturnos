-- ============================================================
-- 011 — OAuth: vínculos con proveedores externos (Google, etc.)
-- Ref: APP-TURNOS-SPEC/06-AUTH.md §OAuth
--
-- Permite que un usuario inicie sesión con un proveedor externo
-- (Google en MVP; preparado para Apple/Facebook en el futuro).
-- Un usuario puede tener varios vínculos (un Google + un Apple, etc.)
-- pero cada (provider, provider_user_id) es único globalmente.
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios_oauth (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id          INT NOT NULL
    COMMENT 'FK a usuarios.id',
  provider            VARCHAR(32) NOT NULL
    COMMENT 'Nombre del proveedor: google, apple, facebook, ...',
  provider_user_id    VARCHAR(255) NOT NULL
    COMMENT 'Subject (sub) del id_token devuelto por el proveedor',
  email               VARCHAR(200) NULL
    COMMENT 'Email reportado por el proveedor al momento del vínculo',
  email_verified      TINYINT NOT NULL DEFAULT 0
    COMMENT '1 si el proveedor confirmó la propiedad del email',
  avatar_url          VARCHAR(500) NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultima_sesion       TIMESTAMP NULL,
  UNIQUE KEY uk_provider_user (provider, provider_user_id),
  UNIQUE KEY uk_usuario_provider (usuario_id, provider),
  KEY idx_usuario (usuario_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Vínculos OAuth de usuarios con proveedores externos';
