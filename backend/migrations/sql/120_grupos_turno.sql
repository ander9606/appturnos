-- ============================================================
-- 120 — Grupos de turnos
--
-- Permite agrupar turnos de distintos días bajo un mismo contexto (una feria, una
-- obra, un proyecto…) con un nombre y, opcionalmente, un lugar por defecto. El
-- nombre que ve el cliente en pantalla lo configura cada empresa (`etiqueta_grupo`);
-- aquí todo se llama "grupo" para no atar el modelo a ninguna industria.
--
-- Es una migración ADITIVA: no modifica ni borra datos existentes.
--   * `grupos_turno`            tabla nueva.
--   * `ofertas_turno.grupo_id`  NULL = "sin grupo". Todos los turnos actuales quedan
--                               en NULL, así que ninguna consulta ni cálculo cambia.
--   * `empresas.usa_grupos_turno`  0 por defecto: la función queda apagada para todas
--                                  las empresas hasta que su admin_empresa la active.
--   * `empresas.etiqueta_grupo`    texto opcional para renombrar "Grupo" ("Evento", "Obra").
--
-- Re-ejecutable: MySQL no revierte el DDL si falla a la mitad, así que cada paso se
-- protege (CREATE ... IF NOT EXISTS / ALTER solo si la columna aún no existe). Cada
-- ALTER es un único statement, que MySQL aplica completo o no aplica.
--
-- Qué NO guarda el grupo: las fechas (se calculan con MIN/MAX de sus turnos para que
-- nunca queden desactualizadas) ni hora, tarifa o plazas (cambian de un turno a otro).
-- El lugar es solo un valor por defecto: cada turno guarda su propia copia, así que
-- cambiar el lugar del grupo nunca mueve el punto de marcaje de turnos ya publicados.
-- ============================================================

-- 1. Tabla de grupos -------------------------------------------------------
CREATE TABLE IF NOT EXISTS grupos_turno (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT NULL,
  -- Lugar por defecto para los turnos nuevos del grupo. Mismos tipos que ofertas_turno
  -- para poder copiarlo tal cual (incluidas las coordenadas del geocerco).
  lugar VARCHAR(300) NULL,
  latitud DECIMAL(10,8) NULL,
  longitud DECIMAL(11,8) NULL,
  estado ENUM('activo','cerrado') NOT NULL DEFAULT 'activo',
  cerrado_at TIMESTAMP NULL,
  creado_por INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Con la collation utf8mb4_unicode_ci "Feria" y "feria" cuentan como el mismo nombre.
  UNIQUE KEY uk_grupo_empresa_nombre (empresa_id, nombre),
  INDEX idx_grupos_empresa_estado (empresa_id, estado),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  -- Las coordenadas van juntas o no van: nunca una latitud sin su longitud.
  CONSTRAINT chk_grupo_coordenadas CHECK ((latitud IS NULL) = (longitud IS NULL))
) ENGINE=InnoDB;

-- 2. ofertas_turno.grupo_id ------------------------------------------------
-- Sin ON DELETE: el comportamiento por defecto (RESTRICT) impide borrar un grupo que
-- aún tiene turnos, para no dejarlos huérfanos sin aviso. Los grupos se cierran, no se borran.
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ofertas_turno' AND COLUMN_NAME = 'grupo_id');
SET @ddl = IF(@col = 0,
  'ALTER TABLE ofertas_turno
     ADD COLUMN grupo_id INT NULL AFTER empresa_id,
     ADD INDEX idx_ofertas_grupo (grupo_id),
     ADD CONSTRAINT fk_ofertas_grupo FOREIGN KEY (grupo_id) REFERENCES grupos_turno(id)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Interruptor y etiqueta por empresa ------------------------------------
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'empresas' AND COLUMN_NAME = 'usa_grupos_turno');
SET @ddl = IF(@col = 0,
  'ALTER TABLE empresas
     ADD COLUMN usa_grupos_turno TINYINT(1) NOT NULL DEFAULT 0,
     ADD COLUMN etiqueta_grupo VARCHAR(40) NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
