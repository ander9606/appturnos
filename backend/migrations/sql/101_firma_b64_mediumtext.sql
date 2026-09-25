-- ============================================================
-- 101 — Firmas digitales: TEXT → MEDIUMTEXT
--
-- SignaturePad ahora dibuja el trazo con curvas cuadráticas en vez de
-- segmentos rectos (ver 5e9157e, "suavizar el trazo") — el SVG resultante
-- tiene bastantes más puntos de control, y en base64 una firma con trazo
-- largo ya supera el límite de TEXT (65.535 bytes ≈ 64 KB), lo que revienta
-- el UPDATE con "Data too long for column 'firma_b64'". Mismo criterio que
-- 098 (empresas.logo_url → MEDIUMTEXT, 16 MB) para datos base64 que crecen
-- con el uso.
--
-- contratos_diarios.firma_b64, cuentas_cobro.firma_b64 y
-- trabajadores.firma_guardada guardan la misma firma dibujada en
-- SignaturePad — las tres se amplían juntas.
-- ============================================================

ALTER TABLE contratos_diarios
  MODIFY COLUMN firma_b64 MEDIUMTEXT NULL;

ALTER TABLE cuentas_cobro
  MODIFY COLUMN firma_b64 MEDIUMTEXT NULL;

ALTER TABLE trabajadores
  MODIFY COLUMN firma_guardada MEDIUMTEXT NULL
    COMMENT 'Última firma digital dibujada por el trabajador, reutilizable en futuros contratos';
