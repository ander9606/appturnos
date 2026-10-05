-- Descuentos por turno (faltas, daños, etc.). Mismo flujo que descuentos_nomina:
-- el gestor registra monto y motivo, el trabajador recibe notificación y acepta
-- o rechaza. Solo los aceptados restan del pago del turno (liquidación y cuenta
-- de cobro) y se listan en el contrato del turno. La aceptación explícita por
-- escrito es el consentimiento para cada caso (CST art. 149), así que aceptar un
-- descuento no reinicia la firma del contrato.

CREATE TABLE descuentos_turno (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id      INT NOT NULL,
  asignacion_id   INT NOT NULL,
  trabajador_id   INT NOT NULL,
  monto           DECIMAL(10,2) NOT NULL,
  motivo          VARCHAR(255) NOT NULL,
  estado          ENUM('pendiente','aceptado','rechazado') NOT NULL DEFAULT 'pendiente',
  creado_por      INT NOT NULL,
  respondido_at   DATETIME NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dto_turno_empresa     FOREIGN KEY (empresa_id)    REFERENCES empresas(id)          ON DELETE CASCADE,
  CONSTRAINT fk_dto_turno_asignacion  FOREIGN KEY (asignacion_id) REFERENCES asignaciones_turno(id) ON DELETE CASCADE,
  CONSTRAINT fk_dto_turno_trabajador  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id)      ON DELETE CASCADE,
  KEY idx_dto_turno_asignacion (empresa_id, asignacion_id, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
