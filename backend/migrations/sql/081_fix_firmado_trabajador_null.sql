-- Arreglar contratos con firmado_trabajador = NULL
-- Los contratos creados antes del fix tenían NULL en lugar de 0
-- Esto causaba que no aparecieran en listarSinFirmar() porque NULL != 0

UPDATE contratos_diarios
SET firmado_trabajador = 0
WHERE firmado_trabajador IS NULL;
