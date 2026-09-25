-- ============================================================
-- 082 — Cuentas de cobro (prestación de servicios)
--
-- Al cerrar un período de una empresa con tipo_contrato =
-- 'prestacion_servicios', se genera una cuenta de cobro por trabajador
-- con los turnos completados y con contrato diario ya firmado dentro del
-- rango del período (mismo criterio que AsignacionesModel.liquidacion:
-- turnos sin firma no cuentan). `items` es un snapshot congelado en JSON
-- — una vez firmada la cuenta, nunca se vuelve a tocar (ver
-- cuentas-cobro.model.js: crear() solo actualiza si firmado_trabajador = 0).
-- ============================================================

CREATE TABLE IF NOT EXISTS cuentas_cobro (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  periodo_id INT NOT NULL,
  trabajador_id INT NOT NULL,
  numero_cuenta VARCHAR(50) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  total_turnos INT NOT NULL DEFAULT 0,
  total_horas DECIMAL(7,2) NOT NULL DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  items JSON NOT NULL COMMENT 'Snapshot congelado: [{asignacion_id, fecha, descripcion, hora_inicio, hora_fin, horas, valor}]',
  firmado_trabajador TINYINT DEFAULT 0,
  firmado_at TIMESTAMP NULL,
  firma_b64 TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_cuenta_periodo_trabajador (periodo_id, trabajador_id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (periodo_id) REFERENCES periodos_nomina(id),
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id),
  INDEX idx_cuentas_cobro_trabajador (trabajador_id, firmado_trabajador)
) ENGINE=InnoDB;
