-- ============================================================
-- 002 — Trabajadores
-- Ref: APP-TURNOS-SPEC/02-BASE-DATOS.md
-- ============================================================

-- Personas físicas. Pueden ser de track Nómina, Turnos o ambos.
-- usuario_id es NULL si el trabajador aún no activó cuenta en la app.
CREATE TABLE IF NOT EXISTS trabajadores (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  usuario_id INT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  cedula VARCHAR(20),
  telefono VARCHAR(20),
  email VARCHAR(200),
  tipo ENUM('nomina','turnos','ambos') NOT NULL DEFAULT 'turnos',
  cargo VARCHAR(100),
  tarifa_hora DECIMAL(10,2),
  salario_base DECIMAL(12,2),
  activo TINYINT DEFAULT 1,
  external_ref VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  INDEX idx_trabajadores_empresa (empresa_id, activo),
  INDEX idx_trabajadores_external (external_ref)
) ENGINE=InnoDB;
