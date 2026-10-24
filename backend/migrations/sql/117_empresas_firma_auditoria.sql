-- ============================================================
-- 117 — Auditoría de cambios a la firma del representante legal
-- Mismo patrón que trabajadores_salario_auditoria (migración 108): quién,
-- cuándo, desde qué IP — pero nunca el valor de la firma, solo un hash
-- para detectar si cambió. Sin FK a usuarios: el registro debe sobrevivir
-- si esa cuenta se anonimiza (ver AuthModel.eliminarCuenta).
-- ============================================================

CREATE TABLE IF NOT EXISTS empresas_firma_auditoria (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  accion ENUM('creada','actualizada','eliminada') NOT NULL,
  hash_anterior CHAR(64) NULL,
  hash_nueva CHAR(64) NULL,
  usuario_id INT NULL,
  usuario_nombre VARCHAR(200) NOT NULL,
  usuario_rol VARCHAR(50) NOT NULL,
  ip VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  INDEX idx_firma_aud_empresa (empresa_id, created_at)
) ENGINE=InnoDB;
