-- OTP codes for email and phone verification before account creation
CREATE TABLE IF NOT EXISTS codigos_verificacion (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tipo        ENUM('email', 'telefono') NOT NULL,
  destino     VARCHAR(255) NOT NULL,
  codigo      VARCHAR(6)   NOT NULL,
  expires_at  DATETIME     NOT NULL,
  usado       TINYINT(1)   NOT NULL DEFAULT 0,
  intentos    INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_destino_tipo (destino(100), tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
