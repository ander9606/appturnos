CREATE TABLE IF NOT EXISTS novedades (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id   INT NOT NULL,
  asignacion_id INT NOT NULL,
  autor_id     INT NOT NULL,
  tipo         ENUM('retraso','ausencia','incidente','otro') NOT NULL,
  descripcion  TEXT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id)    REFERENCES empresas(id),
  FOREIGN KEY (asignacion_id) REFERENCES asignaciones_turno(id),
  FOREIGN KEY (autor_id)      REFERENCES usuarios(id),
  INDEX idx_asignacion (empresa_id, asignacion_id)
);
