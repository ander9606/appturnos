-- ============================================================
-- 089 — Períodos de Pago de Turnos
-- Sincroniza el pago de turnos con los períodos de liquidación de nómina
-- ============================================================

-- Tabla de períodos de pago para turnos (personal de turnos + extras)
CREATE TABLE IF NOT EXISTS periodos_turnos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  tipo ENUM('semanal','quincenal','mensual','trimestral') NOT NULL DEFAULT 'quincenal',
  es_extra_nomina TINYINT DEFAULT 0 COMMENT 'Si 1: trimestral para turnos extras de trabajador_nomina',
  estado ENUM('abierto','cerrado','liquidado') DEFAULT 'abierto',
  cerrado_por INT NULL,
  cerrado_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  UNIQUE KEY uk_periodo_rango (empresa_id, fecha_inicio, fecha_fin, es_extra_nomina),
  INDEX idx_periodo_estado (empresa_id, estado)
) ENGINE=InnoDB;

-- Vincular asignaciones de turno a su período de pago
-- Inicialmente NULL para datos históricos; se poblarán al cierre del período
ALTER TABLE asignaciones_turno
  ADD COLUMN periodo_turno_id INT NULL AFTER pago_total,
  ADD FOREIGN KEY fk_asignacion_periodo (periodo_turno_id) REFERENCES periodos_turnos(id);

-- Rastrear cuáles asignaciones se pagaron (similar a pagado_at pero vinculado al período)
ALTER TABLE asignaciones_turno
  ADD COLUMN periodo_pago_id INT NULL COMMENT 'Período en el cual se liquidó/pagó el turno',
  ADD FOREIGN KEY fk_asignacion_periodo_pago (periodo_pago_id) REFERENCES periodos_turnos(id);
