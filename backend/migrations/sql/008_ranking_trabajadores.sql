-- ============================================================
-- 008 — Ranking de trabajadores y calificaciones por turno
-- Ref: agregado posterior a APP-TURNOS-SPEC.
--
-- Cada vez que un turno se completa, el jefe de turnos califica al
-- trabajador (1–5 estrellas). El ranking del trabajador es el promedio
-- de sus calificaciones y se usa para escalonar la visibilidad de las
-- ofertas: los mejor calificados las ven primero.
-- ============================================================

ALTER TABLE trabajadores
  ADD COLUMN ranking DECIMAL(3,2) NULL
    COMMENT 'Promedio de calificaciones (0.00 a 5.00). NULL si aún no tiene.',
  ADD COLUMN total_calificaciones INT NOT NULL DEFAULT 0
    COMMENT 'Número de calificaciones acumuladas.';

CREATE INDEX idx_trabajadores_ranking ON trabajadores (empresa_id, ranking);

CREATE TABLE IF NOT EXISTS calificaciones_turno (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  asignacion_id INT NOT NULL,
  trabajador_id INT NOT NULL,
  calificacion TINYINT NOT NULL COMMENT '1 a 5 estrellas',
  comentario VARCHAR(500) NULL,
  calificado_por INT NOT NULL COMMENT 'usuario_id del jefe que califica',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_calificacion_asignacion (asignacion_id),
  CONSTRAINT fk_calif_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
  CONSTRAINT fk_calif_asignacion FOREIGN KEY (asignacion_id)
    REFERENCES asignaciones_turno (id) ON DELETE CASCADE,
  CONSTRAINT fk_calif_trabajador FOREIGN KEY (trabajador_id) REFERENCES trabajadores (id),
  INDEX idx_calif_trabajador (trabajador_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
