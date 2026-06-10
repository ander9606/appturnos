-- ============================================================
-- 019 — Empresas de interés pre-seleccionadas al crear trabajador
-- Al crear la ficha de un trabajador, el admin puede indicar a qué
-- empresas del directorio desea postularse. Al activar su cuenta, el
-- sistema crea automáticamente las solicitudes de vinculación.
-- ============================================================

ALTER TABLE trabajadores
  ADD COLUMN empresas_postulacion JSON NULL
    COMMENT 'IDs de empresas a las que se crearán solicitudes al activar cuenta'
    AFTER ant_disciplinarios_fecha;
