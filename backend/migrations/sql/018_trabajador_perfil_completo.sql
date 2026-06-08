-- ============================================================
-- 018 — Perfil completo de trabajador
-- Agrega campos de perfil extendido y tablas relacionadas para
-- documentos de identidad, seguridad social, cuenta bancaria,
-- antecedentes, experiencia laboral, diplomas y cargos.
-- ============================================================

ALTER TABLE trabajadores
  ADD COLUMN tipo_documento ENUM('CC','CE','PAS') DEFAULT 'CC' AFTER cedula,
  ADD COLUMN fecha_nacimiento DATE AFTER tipo_documento,
  ADD COLUMN sexo ENUM('M','F','otro') AFTER fecha_nacimiento,
  ADD COLUMN contacto_emergencia_nombre VARCHAR(150) AFTER sexo,
  ADD COLUMN contacto_emergencia_tel VARCHAR(20) AFTER contacto_emergencia_nombre,
  ADD COLUMN eps VARCHAR(100) AFTER contacto_emergencia_tel,
  ADD COLUMN afp VARCHAR(100) AFTER eps,
  ADD COLUMN banco VARCHAR(80) AFTER afp,
  ADD COLUMN tipo_cuenta ENUM('ahorros','corriente') AFTER banco,
  ADD COLUMN numero_cuenta VARCHAR(30) AFTER tipo_cuenta,
  ADD COLUMN ant_judiciales_fecha DATE AFTER numero_cuenta,
  ADD COLUMN ant_disciplinarios_fecha DATE AFTER ant_judiciales_fecha;

-- Historial laboral (múltiples por trabajador)
CREATE TABLE IF NOT EXISTS trabajador_experiencias (
  id INT PRIMARY KEY AUTO_INCREMENT,
  trabajador_id INT NOT NULL,
  empresa_nombre VARCHAR(150) NOT NULL,
  cargo VARCHAR(100) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  INDEX idx_exp_trabajador (trabajador_id),
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Diplomas y certificados académicos
CREATE TABLE IF NOT EXISTS trabajador_diplomas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  trabajador_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  institucion VARCHAR(150) NOT NULL,
  anio YEAR,
  INDEX idx_dip_trabajador (trabajador_id),
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Cargos del catálogo que el trabajador tiene certificados
CREATE TABLE IF NOT EXISTS trabajador_cargos (
  trabajador_id INT NOT NULL,
  cargo_id INT NOT NULL,
  PRIMARY KEY (trabajador_id, cargo_id),
  INDEX idx_tc_cargo (cargo_id),
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id) ON DELETE CASCADE,
  FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE CASCADE
) ENGINE=InnoDB;
