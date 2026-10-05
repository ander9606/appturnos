-- ============================================================
-- 108 — Auditoría de cambios de sueldo (trazabilidad legal)
--
-- Cada cambio de tarifa_hora / salario_base queda registrado con quién lo
-- hizo, cuándo, desde qué IP y el valor anterior y el nuevo. La app solo
-- inserta; no hay endpoint que la modifique ni la borre.
--
-- Sin FK a trabajadores ni a usuarios: el registro debe sobrevivir al borrado
-- definitivo de la ficha y a la anonimización de la cuenta. Por eso se guardan
-- snapshots de nombres.
-- ============================================================

CREATE TABLE IF NOT EXISTS trabajadores_salario_auditoria (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  trabajador_id INT NOT NULL,
  trabajador_nombre VARCHAR(200) NOT NULL,
  tarifa_hora_anterior DECIMAL(10,2) NULL,
  tarifa_hora_nueva DECIMAL(10,2) NULL,
  salario_base_anterior DECIMAL(12,2) NULL,
  salario_base_nueva DECIMAL(12,2) NULL,
  usuario_id INT NULL,
  usuario_nombre VARCHAR(200) NOT NULL,
  usuario_rol VARCHAR(50) NOT NULL,
  ip VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  INDEX idx_salario_aud_trabajador (empresa_id, trabajador_id, created_at)
) ENGINE=InnoDB;
