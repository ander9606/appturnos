-- ============================================================
-- 012 — Catálogo de cargos y cargos por trabajador
-- Ref: APP-TURNOS-SPEC/02-DATABASE.md §Cargos, 05-NEGOCIO.md §Perfiles de trabajador
--
-- Modelo:
--   - `cargos` es un catálogo híbrido: sistema (empresa_id=NULL) + custom por empresa.
--   - `trabajador_cargos` cuelga del vínculo trabajador↔empresa: el cargo
--     es reconocido por una empresa específica, no es global del trabajador.
--     Ser jefe de montaje en empresa A NO te hace jefe en empresa B.
--   - La unicidad de (empresa_id=NULL, codigo) NO la garantiza la DB
--     (MySQL trata NULLs como distintos en UNIQUE). La controlamos en
--     migración: solo agregamos cargos del sistema vía SQL revisado.
-- ============================================================

CREATE TABLE IF NOT EXISTS cargos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id  INT NULL
    COMMENT 'NULL = cargo del sistema; valor = custom de esa empresa',
  codigo      VARCHAR(50) NOT NULL
    COMMENT 'Slug interno, ej. auxiliar, jefe_montaje, conductor',
  nombre      VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255) NULL,
  activo      TINYINT NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_empresa_codigo (empresa_id, codigo),
  KEY idx_empresa (empresa_id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB
  COMMENT='Catálogo de cargos (sistema + custom por empresa)';

-- Seed inicial: cargos del sistema disponibles para todas las empresas.
INSERT INTO cargos (empresa_id, codigo, nombre, descripcion) VALUES
  (NULL, 'auxiliar',     'Auxiliar',
    'Personal de apoyo general en montajes y operaciones'),
  (NULL, 'jefe_montaje', 'Jefe de montaje',
    'Coordina y supervisa el equipo de montaje en sitio'),
  (NULL, 'conductor',    'Conductor',
    'Operador de vehículos para transporte de personal o equipos');

-- Cargos que CADA empresa reconoce a CADA uno de sus trabajadores.
-- Cuelga del vínculo (trabajador_empresa.id), no del usuario directo:
-- así un mismo trabajador puede tener cargos distintos en empresas distintas.
CREATE TABLE IF NOT EXISTS trabajador_cargos (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  trabajador_empresa_id INT NOT NULL
    COMMENT 'FK al vínculo trabajador_empresa',
  cargo_id              INT NOT NULL,
  asignado_por          INT NOT NULL
    COMMENT 'usuario_id del jefe/admin que asignó el cargo',
  asignado_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_te_cargo (trabajador_empresa_id, cargo_id),
  KEY idx_cargo (cargo_id),
  FOREIGN KEY (trabajador_empresa_id)
    REFERENCES trabajador_empresa(id) ON DELETE CASCADE,
  FOREIGN KEY (cargo_id)     REFERENCES cargos(id),
  FOREIGN KEY (asignado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB
  COMMENT='Cargos que la empresa certifica para cada trabajador';
