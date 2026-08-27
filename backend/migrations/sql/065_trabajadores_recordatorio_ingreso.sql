-- 065 — Recordatorio de inicio de turno para trabajadores de nómina
--
-- hora_entrada_esperada es opcional (NULL = sin recordatorio) y la define el
-- gestor por trabajador — horario fijo, no por día de semana (el caso común
-- en nómina). recordatorioIngreso.worker.js la usa para avisar dentro de los
-- 15 min previos a esa hora si el trabajador todavía no ha marcado ingreso.
ALTER TABLE trabajadores
  ADD COLUMN hora_entrada_esperada TIME NULL
    COMMENT 'Hora habitual de entrada — si está definida, dispara el recordatorio de inicio de turno'
    AFTER punto_marcaje_id;

-- Idempotencia del worker: una fila = ya se avisó a este trabajador hoy.
-- Mismo propósito que registros_diarios.alerta_extra_enviada (055) y
-- descansos_compensatorios.notificado_gestor (064), pero en tabla aparte
-- porque acá todavía no existe un registro_diarios (el trabajador no ha
-- marcado ingreso) al que colgarle el flag.
CREATE TABLE recordatorios_ingreso_enviados (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  trabajador_id  INT NOT NULL,
  fecha          DATE NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_recordatorio (trabajador_id, fecha),
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
