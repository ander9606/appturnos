-- ============================================================
-- 102 — asignaciones_turno.firma_digital: TEXT → MEDIUMTEXT
--
-- La 101 amplió contratos_diarios.firma_b64, cuentas_cobro.firma_b64 y
-- trabajadores.firma_guardada (mismo trazo curvo de SignaturePad, base64
-- que ya supera el límite de TEXT de 64 KB), pero se le olvidó
-- asignaciones_turno.firma_digital — la columna que escribe marcarEgreso
-- cuando el trabajador cierra su propio turno y firma en un solo paso.
-- Un trazo suficientemente detallado revienta ese UPDATE con "Data too
-- long for column 'firma_digital'", un código MySQL no mapeado en
-- errorHandler.js, así que cae como 500 genérico. El mismo cierre vía
-- corregir() (el gestor) nunca toca esta columna, por eso solo fallaba
-- cuando el propio trabajador cerraba y firmaba de una.
-- ============================================================

ALTER TABLE asignaciones_turno
  MODIFY COLUMN firma_digital MEDIUMTEXT NULL;
