-- ============================================================
-- 001 — Empresas, usuarios y autenticación
-- Ref: APP-TURNOS-SPEC/02-BASE-DATOS.md, 06-AUTH.md
-- ============================================================

-- Tenant raíz: cada empresa es un tenant independiente.
CREATE TABLE IF NOT EXISTS empresas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  nit VARCHAR(20),
  ciudad VARCHAR(100),
  activo TINYINT DEFAULT 1,
  plan ENUM('basico','profesional','empresarial') DEFAULT 'basico',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Cuentas con login en la app.
CREATE TABLE IF NOT EXISTS usuarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100),
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin_empresa','jefe_turnos','jefe_nomina','nomina','trabajador_turnos','trabajador_nomina') NOT NULL,
  activo TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB;

-- Refresh tokens (rotación en cada uso — ver 06-AUTH.md).
-- crypto.randomBytes(64).toString('hex') produce 128 caracteres hex.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  usuario_id INT NOT NULL,
  token CHAR(128) NOT NULL,
  expira_at TIMESTAMP NOT NULL,
  revocado TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_refresh_token (token),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  INDEX idx_refresh_usuario (usuario_id, revocado)
) ENGINE=InnoDB;

-- Lockout por intentos fallidos (MAX_INTENTOS=5, LOCKOUT_MINUTOS=15).
CREATE TABLE IF NOT EXISTS intentos_login (
  id INT PRIMARY KEY AUTO_INCREMENT,
  usuario_id INT NOT NULL,
  intentos INT DEFAULT 0,
  bloqueado_hasta TIMESTAMP NULL,
  ultimo_intento TIMESTAMP NULL,
  UNIQUE KEY uk_intentos_usuario (usuario_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;
