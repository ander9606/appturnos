-- ============================================================
-- 006 — Notificaciones in-app
-- Ref: APP-TURNOS-SPEC/04-PANTALLAS.md (sección Notificaciones)
--
-- Almacén de notificaciones por usuario. La entrega vía Web Push / FCM
-- es una capa posterior; esta tabla es la fuente de verdad consultable
-- desde la app.
-- ============================================================

CREATE TABLE IF NOT EXISTS notificaciones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  usuario_id INT NOT NULL COMMENT 'Destinatario de la notificación',
  tipo VARCHAR(60) NOT NULL COMMENT 'oferta.cancelada | postulacion.confirmada | etc.',
  titulo VARCHAR(200) NOT NULL,
  mensaje VARCHAR(500) NOT NULL,
  data JSON NULL COMMENT 'Ids relacionados (oferta_id, asignacion_id, ...)',
  leida TINYINT NOT NULL DEFAULT 0,
  leida_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
  CONSTRAINT fk_notif_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  INDEX idx_notif_usuario (usuario_id, leida, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
