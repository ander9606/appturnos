-- ============================================================
-- 113 — Firma del representante legal de la empresa
-- Se guarda una sola vez (como trabajadores.firma_guardada) y se
-- estampa en todos los contratos, en vez de pedirle al admin que
-- firme cada contrato diario uno por uno. Solo admin_empresa puede
-- cargarla: viaja en el mismo PATCH /api/empresas/me que
-- representante_nombre/representante_cedula, ya restringido a ese rol.
-- MEDIUMTEXT porque admite tanto el SVG de trazos (mobile, como
-- trabajadores.firma_guardada) como una imagen subida (web, como
-- empresas.logo_url) — ver backend/utils/firmaPdf.js.
-- ============================================================

ALTER TABLE empresas
  ADD COLUMN firma_representante_b64 MEDIUMTEXT NULL;
