-- ============================================================
-- 098 — empresas.logo_url acepta imágenes subidas (base64)
--
-- Hasta ahora el admin solo podía pegar la URL pública de un logo
-- externo (VARCHAR 500). Ahora también puede subir el logo desde
-- la app (cámara/galería), igual que la foto de perfil de usuario
-- (usuarios.foto_perfil, MEDIUMTEXT) — se guarda como data URI
-- ("data:image/jpeg;base64,...") en el mismo campo, así que toda
-- URL externa ya guardada sigue funcionando sin cambios.
-- ============================================================

ALTER TABLE empresas
  MODIFY COLUMN logo_url MEDIUMTEXT NULL;
