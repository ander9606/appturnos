-- Soporte de reingresos en el día (jornada partida con autorización del gestor).
-- Estrategia: horas_* acumulan totales de todas las sesiones del día.
--             sesiones lleva el conteo; hora_entrada_inicial preserva la primera entrada.

ALTER TABLE registros_diarios
  ADD COLUMN sesiones            TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER hora_salida,
  ADD COLUMN hora_entrada_inicial TIME                               AFTER sesiones;

-- Retrocompatibilidad: registros existentes con hora_entrada ya tienen una sesión.
UPDATE registros_diarios
  SET hora_entrada_inicial = hora_entrada
  WHERE hora_entrada IS NOT NULL AND hora_entrada_inicial IS NULL;

-- Solicitudes de reingreso: el trabajador pide, el gestor aprueba/rechaza.
CREATE TABLE solicitudes_reingreso (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id    INT NOT NULL,
  registro_id   INT NOT NULL,
  trabajador_id INT NOT NULL,
  estado        ENUM('pendiente','aprobado','rechazado','usado') NOT NULL DEFAULT 'pendiente',
  motivo        VARCHAR(255),
  aprobado_por  INT,
  aprobado_at   DATETIME,
  created_at    DATETIME NOT NULL DEFAULT NOW(),
  INDEX idx_registro (empresa_id, registro_id),
  INDEX idx_estado   (empresa_id, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
