-- `password_hash` es NOT NULL para todo usuario (incluso los registrados solo
-- por OAuth, que reciben un hash aleatorio inutilizable), así que nunca sirvió
-- para distinguir quién tiene una contraseña real. Sin esta columna, el login
-- por Google terminaba pidiendo el teléfono en cada inicio de sesión porque
-- `has_password` no se podía calcular de forma confiable.
ALTER TABLE usuarios
  ADD COLUMN oauth_only TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash;
