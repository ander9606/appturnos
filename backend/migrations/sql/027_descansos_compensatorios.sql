-- 026_descansos_compensatorios.sql
-- Descanso compensatorio por domingo o festivo trabajado (Art. 179 CST).
-- Se crea automáticamente al registrar la salida de un día domenical/festivo.
-- El jefe_nomina / admin asigna la fecha concreta; el trabajador ve la alerta.

CREATE TABLE IF NOT EXISTS descansos_compensatorios (
  id                 INT          NOT NULL AUTO_INCREMENT,
  empresa_id         INT          NOT NULL,
  trabajador_id      INT          NOT NULL,
  periodo_id         INT          NOT NULL,
  origen_fecha       DATE         NOT NULL,          -- el domingo/festivo trabajado
  origen_registro_id INT          NULL,              -- FK a registros_diarios
  estado             ENUM('pendiente','asignado','tomado') NOT NULL DEFAULT 'pendiente',
  fecha_asignada     DATE         NULL,              -- asignada por el empleador
  asignado_por       INT          NULL,              -- usuario_id que asignó
  asignado_en        DATETIME     NULL,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_compensatorio_registro (empresa_id, origen_registro_id),
  INDEX idx_comp_empresa_trabajador (empresa_id, trabajador_id),
  INDEX idx_comp_estado             (empresa_id, estado),
  CONSTRAINT fk_comp_empresa     FOREIGN KEY (empresa_id)         REFERENCES empresas(id)            ON DELETE CASCADE,
  CONSTRAINT fk_comp_trabajador  FOREIGN KEY (trabajador_id)      REFERENCES trabajadores(id)        ON DELETE CASCADE,
  CONSTRAINT fk_comp_periodo     FOREIGN KEY (periodo_id)         REFERENCES periodos_nomina(id)     ON DELETE CASCADE,
  CONSTRAINT fk_comp_registro    FOREIGN KEY (origen_registro_id) REFERENCES registros_diarios(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
