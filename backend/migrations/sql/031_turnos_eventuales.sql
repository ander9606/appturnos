-- 031: Turnos eventuales para trabajadores de nómina

ALTER TABLE ofertas_turno
  ADD COLUMN para_quien ENUM('turnos','nomina','ambos') NOT NULL DEFAULT 'turnos';

CREATE TABLE IF NOT EXISTS periodos_turno_eventual (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id   INT NOT NULL,
  anio         SMALLINT NOT NULL,
  trimestre    TINYINT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  estado       ENUM('abierto','liquidado') NOT NULL DEFAULT 'abierto',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_empresa_trim (empresa_id, anio, trimestre),
  KEY idx_empresa_estado (empresa_id, estado)
);
