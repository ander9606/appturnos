-- ============================================================
-- 004 — Track Turnos: ofertas, asignaciones y contratos diarios
-- Ref: APP-TURNOS-SPEC/02-BASE-DATOS.md
-- ============================================================

-- Oferta de un día de trabajo. Puede estar vinculada a una orden de
-- logiq360 vía external_ref o ser una oferta libre.
CREATE TABLE IF NOT EXISTS ofertas_turno (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin_estimada TIME,
  lugar VARCHAR(300),
  latitud DECIMAL(10,8),
  longitud DECIMAL(11,8),
  plazas_disponibles INT NOT NULL DEFAULT 1,
  plazas_cubiertas INT DEFAULT 0,
  tarifa_dia DECIMAL(10,2) NOT NULL,
  estado ENUM('abierta','en_proceso','completada','cancelada') DEFAULT 'abierta',
  external_ref VARCHAR(100),
  creado_por INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  INDEX idx_ofertas_fecha (empresa_id, fecha, estado)
) ENGINE=InnoDB;

-- Vínculo trabajador ↔ oferta. Registra marcaje GPS, firma y pago.
CREATE TABLE IF NOT EXISTS asignaciones_turno (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  oferta_id INT NOT NULL,
  trabajador_id INT NOT NULL,
  estado ENUM('pendiente','confirmado','en_progreso','completado','no_presentado','cancelado') DEFAULT 'pendiente',
  hora_ingreso_real TIMESTAMP NULL,
  hora_egreso_real TIMESTAMP NULL,
  latitud_ingreso DECIMAL(10,8),
  longitud_ingreso DECIMAL(11,8),
  firma_digital TEXT NULL,
  contrato_pdf_url VARCHAR(500),
  horas_trabajadas DECIMAL(5,2),
  pago_total DECIMAL(10,2),
  pagado_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_asignacion (oferta_id, trabajador_id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (oferta_id) REFERENCES ofertas_turno(id),
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id)
) ENGINE=InnoDB;

-- Documento legal por asignación (uno a uno con asignaciones_turno).
CREATE TABLE IF NOT EXISTS contratos_diarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  asignacion_id INT NOT NULL UNIQUE,
  numero_contrato VARCHAR(50),
  fecha DATE NOT NULL,
  descripcion_labor TEXT,
  valor_dia DECIMAL(10,2),
  firmado_trabajador TINYINT DEFAULT 0,
  firmado_at TIMESTAMP NULL,
  firma_b64 TEXT,
  pdf_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (asignacion_id) REFERENCES asignaciones_turno(id)
) ENGINE=InnoDB;
