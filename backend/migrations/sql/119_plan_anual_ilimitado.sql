-- ============================================================
-- 119 — precio anual por plan, plan Ilimitado y base del prorrateo
--
-- planes.precio_anual_cop: lo que cuesta pagar 12 meses de una vez (NULL =
-- 10 × mensual). Números redondos para el cobro de Wompi. Para el Empresarial
-- cubre los `incluidos`; cada trabajador adicional vale 10 × precio_adicional.
-- Plan 'ilimitado': precio fijo, sin tope ni cobro por adicionales.
-- empresas.suscripcion_valor_mes_cop / suscripcion_meses: lo que pagó la
-- empresa por mes en su período vigente y si fue mensual (1) o anual (12);
-- con eso se cobra solo la diferencia al subir de plan a mitad de vigencia.
-- Las empresas que ya pagaron antes quedan en NULL: su primer cambio de plan
-- se cobra completo.
-- ============================================================

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'planes' AND COLUMN_NAME = 'precio_anual_cop');
SET @ddl = IF(@col = 0,
  'ALTER TABLE planes ADD COLUMN precio_anual_cop INT UNSIGNED NULL AFTER precio_cop',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE planes
  MODIFY COLUMN codigo ENUM('basico','profesional','empresarial','ilimitado') NOT NULL;

ALTER TABLE empresas
  MODIFY COLUMN plan ENUM('basico','profesional','empresarial','ilimitado') DEFAULT 'basico';

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'empresas' AND COLUMN_NAME = 'suscripcion_valor_mes_cop');
SET @ddl = IF(@col = 0,
  'ALTER TABLE empresas ADD COLUMN suscripcion_valor_mes_cop INT UNSIGNED NULL AFTER suscripcion_origen, ADD COLUMN suscripcion_meses TINYINT UNSIGNED NULL AFTER suscripcion_valor_mes_cop',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO planes (codigo, nombre, orden, max_trabajadores, precio_cop, precio_anual_cop, incluidos, precio_adicional_cop) VALUES
  ('ilimitado', 'Ilimitado', 4, NULL, 400000, 4000000, NULL, NULL);

UPDATE planes SET precio_anual_cop = 1300000 WHERE codigo = 'basico'      AND precio_anual_cop IS NULL;
UPDATE planes SET precio_anual_cop = 1700000 WHERE codigo = 'profesional' AND precio_anual_cop IS NULL;
UPDATE planes SET precio_anual_cop = 3000000 WHERE codigo = 'empresarial' AND precio_anual_cop IS NULL;
