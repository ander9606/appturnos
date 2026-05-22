-- ============================================================
-- 003 — Track Nómina: períodos y registros diarios
-- Ref: APP-TURNOS-SPEC/02-BASE-DATOS.md
-- ============================================================

-- Ciclo de nómina (semanal / quincenal / mensual).
CREATE TABLE IF NOT EXISTS periodos_nomina (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  tipo ENUM('semanal','quincenal','mensual') NOT NULL DEFAULT 'quincenal',
  estado ENUM('abierto','cerrado','liquidado') DEFAULT 'abierto',
  cerrado_por INT NULL,
  cerrado_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB;

-- Acumulación diaria de horas por trabajador. Las horas con recargo
-- se calculan al cierre del día (ver utils/laboralUtils.js).
CREATE TABLE IF NOT EXISTS registros_diarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  trabajador_id INT NOT NULL,
  periodo_id INT NOT NULL,
  fecha DATE NOT NULL,
  hora_entrada TIME,
  hora_salida TIME,
  horas_ordinarias DECIMAL(5,2) DEFAULT 0,
  horas_extra_diurnas DECIMAL(5,2) DEFAULT 0,
  horas_extra_nocturnas DECIMAL(5,2) DEFAULT 0,
  horas_nocturnas DECIMAL(5,2) DEFAULT 0,
  horas_festivo DECIMAL(5,2) DEFAULT 0,
  es_festivo TINYINT DEFAULT 0,
  novedad TEXT NULL,
  aprobado_por INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_registro (empresa_id, trabajador_id, fecha),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id),
  FOREIGN KEY (periodo_id) REFERENCES periodos_nomina(id)
) ENGINE=InnoDB;
