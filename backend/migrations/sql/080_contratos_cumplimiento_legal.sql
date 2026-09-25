-- ============================================================
-- 080 — Cumplimiento Legal: Contratos Diarios
-- Agregar campos para cumplimiento con ley laboral colombiana
-- ============================================================

-- Agregar campos de cumplimiento legal a contratos_diarios
ALTER TABLE contratos_diarios ADD COLUMN tipo_contrato ENUM('LABORAL', 'PRESTACION_SERVICIOS') DEFAULT 'LABORAL' AFTER empresa_id;
ALTER TABLE contratos_diarios ADD COLUMN salario_minimo_validado TINYINT DEFAULT 0 COMMENT 'Si 1: salario cumple SMMLV' AFTER valor_dia;
ALTER TABLE contratos_diarios ADD COLUMN contrato_acumulativo_advertencia TINYINT DEFAULT 0 COMMENT 'Alerta si trabajador excede 50 contratos en 12 meses' AFTER salario_minimo_validado;

-- Crear tabla de auditoría para contratos acumulativos
CREATE TABLE IF NOT EXISTS contratos_acumulacion_auditoria (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  trabajador_id INT NOT NULL,
  contratos_ultima_12_meses INT NOT NULL,
  estado ENUM('normal', 'alerta_40', 'alerta_50', 'bloqueado') DEFAULT 'normal',
  fecha_revision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accion ENUM('generacion_permitida', 'advertencia_mostrada', 'generacion_bloqueada') NOT NULL,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id),
  INDEX idx_acumulacion (empresa_id, trabajador_id, fecha_revision)
) ENGINE=InnoDB;

-- Índice para consultas de acumulación de contratos
CREATE INDEX idx_contratos_trabajador_fecha ON contratos_diarios(empresa_id, asignacion_id, created_at);
