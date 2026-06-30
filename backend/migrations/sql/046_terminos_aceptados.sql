-- 046 — Columna para registrar aceptación de términos y condiciones
ALTER TABLE usuarios ADD COLUMN terminos_aceptados_at DATETIME NULL DEFAULT NULL;