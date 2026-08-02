-- Funciones (responsabilidades) por cargo. Se define por (cargo_id, empresa_id)
-- y no solo por cargo_id porque los cargos de sistema (empresa_id NULL en
-- `cargos`) son compartidos entre empresas — cada empresa debe poder
-- diligenciar su propio listado de funciones incluso para un cargo de
-- sistema como "auxiliar".
CREATE TABLE IF NOT EXISTS cargo_funciones (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cargo_id    INT NOT NULL,
  empresa_id  INT NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  orden       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cargo_empresa (cargo_id, empresa_id),
  FOREIGN KEY (cargo_id)   REFERENCES cargos(id)   ON DELETE CASCADE,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Funciones/responsabilidades que una empresa asigna a un cargo';
