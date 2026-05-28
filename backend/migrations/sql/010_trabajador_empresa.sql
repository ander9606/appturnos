-- ============================================================
-- 010 — Multi-empresa para trabajador_turnos
-- Ref: docs/APP-CONTROL-TURNOS.md, APP-TURNOS-SPEC/02-BASE-DATOS.md
--
-- Cambios:
--   1. empresas: agregar acepta_postulaciones, logo_url, descripcion
--      para el directorio público de empleadores.
--   2. usuarios: permitir empresa_id = NULL para trabajador_turnos
--      (registro libre — modelo marketplace).
--   3. trabajador_empresa: nueva tabla N:N con doble opt-in.
--   4. Backfill: mover los trabajador_turnos existentes a
--      trabajador_empresa y poner empresa_id = NULL en usuarios.
-- ============================================================

-- ── 1. Columnas nuevas en empresas ──────────────────────────────────────────

ALTER TABLE empresas
  ADD COLUMN acepta_postulaciones TINYINT NOT NULL DEFAULT 1
    COMMENT '1 = aparece en el directorio público para trabajadores turnos'
    AFTER plan,
  ADD COLUMN logo_url VARCHAR(500) NULL
    COMMENT 'URL pública del logo de la empresa'
    AFTER acepta_postulaciones,
  ADD COLUMN descripcion TEXT NULL
    COMMENT 'Texto libre de presentación para el directorio'
    AFTER logo_url;

-- ── 2. Permitir empresa_id NULL en usuarios ─────────────────────────────────
-- Solo aplica para rol = 'trabajador_turnos' (registro libre / marketplace).
-- Los demás roles conservan empresa_id NOT NULL por validación de aplicación.

ALTER TABLE usuarios
  MODIFY COLUMN empresa_id INT NULL;

-- ── 3. Tabla trabajador_empresa ──────────────────────────────────────────────
-- Vínculo N:N entre usuarios (trabajador_turnos) y empresas.
-- Doble opt-in: el trabajador solicita → la empresa aprueba,
--               o la empresa invita → el trabajador acepta.

CREATE TABLE IF NOT EXISTS trabajador_empresa (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id          INT NOT NULL
    COMMENT 'FK a usuarios.id (rol TRABAJADOR_TURNOS)',
  empresa_id          INT NOT NULL
    COMMENT 'FK a empresas.id',
  trabajador_id       INT NULL
    COMMENT 'FK a trabajadores.id — se asigna al pasar a activo',
  estado              ENUM(
                        'solicitado_por_trabajador',
                        'solicitado_por_empresa',
                        'activo',
                        'rechazado',
                        'archivado'
                      ) NOT NULL,
  iniciado_por        ENUM('trabajador', 'empresa') NOT NULL,
  fecha_solicitud     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_resuelto      DATETIME NULL,
  motivo_rechazo      VARCHAR(255) NULL,
  UNIQUE KEY uk_usuario_empresa (usuario_id, empresa_id),
  KEY idx_empresa_estado (empresa_id, estado),
  KEY idx_usuario_estado (usuario_id, estado),
  FOREIGN KEY (usuario_id)    REFERENCES usuarios(id)    ON DELETE CASCADE,
  FOREIGN KEY (empresa_id)    REFERENCES empresas(id)    ON DELETE CASCADE,
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Vínculo multi-empresa del trabajador turnos (doble opt-in)';

-- ── 4. Backfill ──────────────────────────────────────────────────────────────
-- Para cada usuario trabajador_turnos que ya tiene empresa_id asignado:
--   a) Crear fila en trabajador_empresa estado 'activo', vinculando al
--      trabajador si su usuario_id ya está seteado en la tabla trabajadores.
--   b) Poner empresa_id = NULL en usuarios.
--
-- Nota: ejecutar como INSERTs directos (compatible con multipleStatements).

INSERT IGNORE INTO trabajador_empresa
  (usuario_id, empresa_id, trabajador_id, estado, iniciado_por, fecha_resuelto)
SELECT
  u.id                 AS usuario_id,
  u.empresa_id         AS empresa_id,
  t.id                 AS trabajador_id,
  'activo'             AS estado,
  'empresa'            AS iniciado_por,
  u.created_at         AS fecha_resuelto
FROM usuarios u
LEFT JOIN trabajadores t
  ON t.usuario_id = u.id AND t.empresa_id = u.empresa_id AND t.activo = 1
WHERE u.rol = 'trabajador_turnos'
  AND u.empresa_id IS NOT NULL;

UPDATE usuarios
SET empresa_id = NULL
WHERE rol = 'trabajador_turnos'
  AND empresa_id IS NOT NULL
  AND id IN (
    SELECT usuario_id FROM trabajador_empresa WHERE estado = 'activo'
  );
