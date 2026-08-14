-- Descuentos manuales de nómina (préstamos, inasistencias injustificadas,
-- daños, anticipos, etc.). A diferencia de salud/pensión (ley, automáticos),
-- estos los registra el gestor y requieren aceptación del trabajador antes
-- de aplicarse al neto de su liquidación (CST art. 149-150: el empleador no
-- puede descontar del salario sin autorización del trabajador).

CREATE TABLE descuentos_nomina (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id      INT NOT NULL,
  trabajador_id   INT NOT NULL,
  periodo_id      INT NOT NULL,
  tipo            ENUM('prestamo','inasistencia','dano_equipo','anticipo','otro') NOT NULL,
  motivo          VARCHAR(255) NOT NULL,
  monto           DECIMAL(12,2) NOT NULL,
  estado          ENUM('pendiente','aceptado','rechazado') NOT NULL DEFAULT 'pendiente',
  creado_por      INT NOT NULL,
  respondido_at   DATETIME NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_desc_empresa    FOREIGN KEY (empresa_id)    REFERENCES empresas(id)        ON DELETE CASCADE,
  CONSTRAINT fk_desc_trabajador FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id)    ON DELETE CASCADE,
  CONSTRAINT fk_desc_periodo    FOREIGN KEY (periodo_id)    REFERENCES periodos_nomina(id) ON DELETE CASCADE,
  KEY idx_desc_periodo    (empresa_id, periodo_id, estado),
  KEY idx_desc_trabajador (empresa_id, trabajador_id, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
