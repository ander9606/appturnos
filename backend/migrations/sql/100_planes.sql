-- ============================================================
-- 100 — precios de los planes de suscripción, editables por super_admin
--
-- Antes vivían en backend/config/constants.js (PLANES): cambiar un precio
-- exigía un deploy. Tabla de plataforma (no por empresa, sin empresa_id):
-- una fila por plan, `codigo` = valores del ENUM empresas.plan.
-- max_trabajadores NULL = sin tope. `incluidos`/`precio_adicional_cop`:
-- trabajadores activos cubiertos por el precio base y cobro por cada uno
-- de más (NULL = no cobra adicionales).
-- ============================================================

CREATE TABLE IF NOT EXISTS planes (
  codigo               ENUM('basico','profesional','empresarial') PRIMARY KEY,
  nombre               VARCHAR(50)  NOT NULL,
  orden                TINYINT      NOT NULL,
  max_trabajadores     INT          NULL,
  precio_cop           INT UNSIGNED NOT NULL,
  incluidos            INT          NULL,
  precio_adicional_cop INT UNSIGNED NULL,
  updated_by           INT          NULL,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO planes (codigo, nombre, orden, max_trabajadores, precio_cop, incluidos, precio_adicional_cop) VALUES
  ('basico',      'Básico',      1, 10,   79000,  NULL, NULL),
  ('profesional', 'Profesional', 2, 30,   169000, NULL, NULL),
  ('empresarial', 'Empresarial', 3, NULL, 299000, 80,   3500);
