-- ============================================================
-- 015 — Puntos de marcaje y tipo de geofence por cargo
--
-- Modelo:
--   puntos_marcaje: ubicaciones físicas donde se puede hacer
--     check-in (bodega, puntos zonales, oficina, etc.)
--   cargos.tipo_geofence: determina cómo valida el ingreso
--     oferta → usa la ubicación del turno (auxiliar montaje)
--     fijo   → usa el punto_marcaje_id del cargo (mantenimiento → bodega)
--     zonal  → cualquier punto tipo='zonal' de la empresa (coordinador)
--     libre  → sin restricción GPS (administrativos)
-- ============================================================

CREATE TABLE IF NOT EXISTS puntos_marcaje (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id   INT NOT NULL,
  nombre       VARCHAR(100) NOT NULL
    COMMENT 'Ej: Bodega Central, Zona Norte, Oficina Principal',
  descripcion  VARCHAR(255) NULL,
  latitud      DECIMAL(10,8) NOT NULL,
  longitud     DECIMAL(11,8) NOT NULL,
  radio_metros INT NOT NULL DEFAULT 100,
  tipo         ENUM('fijo', 'zonal') NOT NULL DEFAULT 'fijo'
    COMMENT 'fijo = punto específico de un cargo; zonal = válido para coordinadores',
  activo       TINYINT NOT NULL DEFAULT 1,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_empresa (empresa_id),
  KEY idx_tipo   (empresa_id, tipo),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB
  COMMENT='Ubicaciones físicas de check-in por empresa';

-- Ampliar cargos con tipo de geofence y punto fijo opcional
ALTER TABLE cargos
  ADD COLUMN tipo_geofence ENUM('oferta','fijo','zonal','libre') NOT NULL DEFAULT 'oferta'
    COMMENT 'Regla de validación GPS al marcar ingreso',
  ADD COLUMN punto_marcaje_id INT NULL
    COMMENT 'Punto fijo obligatorio cuando tipo_geofence=fijo',
  ADD FOREIGN KEY fk_cargo_punto (punto_marcaje_id)
    REFERENCES puntos_marcaje(id) ON DELETE SET NULL;
