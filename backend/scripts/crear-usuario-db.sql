-- ============================================================
-- Setup OPCIONAL — usuario de base de datos dedicado para App Turnos
-- ============================================================
--
-- No es necesario para que la migración funcione: el runner usa las
-- credenciales de .env. Este script existe para NO usar `root` desde la
-- aplicación, que es la buena práctica recomendada.
--
-- Pasos:
--   1. Genera una contraseña fuerte en tu máquina, por ejemplo:
--        openssl rand -base64 24
--   2. Reemplaza CAMBIA_ESTA_PASSWORD abajo por la contraseña generada.
--   3. Ejecútalo con un usuario administrador (normalmente root):
--        mysql -u root -p < scripts/crear-usuario-db.sql
--   4. Copia esas credenciales a tu archivo .env (DB_USER / DB_PASSWORD).
--      NUNCA subas .env ni la contraseña real al repositorio.
--
-- Si tu MySQL es remoto, cambia 'localhost' por '%' o por la IP del backend.
-- ============================================================

CREATE DATABASE IF NOT EXISTS app_turnos
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'turnos_app'@'localhost'
  IDENTIFIED BY 'CAMBIA_ESTA_PASSWORD';

GRANT ALL PRIVILEGES ON app_turnos.* TO 'turnos_app'@'localhost';

FLUSH PRIVILEGES;
