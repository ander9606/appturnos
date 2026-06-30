-- Solicitudes de ausencia: vacaciones, permisos, incapacidades.
-- El trabajador crea la solicitud; el gestor/admin la aprueba o rechaza.
-- Push notification al trabajador cuando cambia el estado.

CREATE TABLE ausencias (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id      INT NOT NULL,
  trabajador_id   INT NOT NULL,
  tipo            ENUM('vacaciones','permiso','incapacidad','otro') NOT NULL,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  motivo          TEXT,
  estado          ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  aprobado_por    INT NULL,
  aprobado_at     DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT NOW(),
  KEY idx_aus_empresa  (empresa_id, estado),
  KEY idx_aus_trabajador (empresa_id, trabajador_id, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;