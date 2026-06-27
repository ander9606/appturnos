-- Migración 040: auditoría de eventos Wompi
-- Persiste cada evento antes de procesarlo para garantizar idempotencia y reintento.
-- UNIQUE(transaction_id) previene dobles activaciones por eventos duplicados.

CREATE TABLE IF NOT EXISTS wompi_eventos (
  id              INT           NOT NULL AUTO_INCREMENT,
  transaction_id  VARCHAR(100)  NOT NULL,
  referencia      VARCHAR(200)  NULL,
  empresa_id      INT           NULL,
  plan            VARCHAR(50)   NULL,
  meses           TINYINT       NULL,
  estado          ENUM('recibido','procesado','error','ignorado') NOT NULL DEFAULT 'recibido',
  intentos        TINYINT       NOT NULL DEFAULT 0,
  payload         JSON          NOT NULL,
  error_detalle   TEXT          NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  procesado_at    TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_transaction_id (transaction_id),
  INDEX idx_wompi_estado_intentos (estado, intentos),
  INDEX idx_wompi_empresa (empresa_id)
) ENGINE=InnoDB;
