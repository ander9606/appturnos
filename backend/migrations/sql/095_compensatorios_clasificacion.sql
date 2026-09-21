-- 095: clasificación ocasional/habitual del descanso compensatorio
--
-- Art. 180 CST (ocasional, <=2 domingos trabajados en el mes calendario):
-- solo compensatorio, sin recargo en dinero para esas horas.
-- Art. 181 CST (habitual, 3+ en el mes): recargo + compensatorio, ambos.
-- Festivos entre semana no tienen esta distinción — siempre quedan en
-- 'habitual' (siempre llevan recargo).
ALTER TABLE descansos_compensatorios
  ADD COLUMN clasificacion ENUM('ocasional','habitual') NOT NULL DEFAULT 'habitual'
    COMMENT 'Art. 180/181 CST — ocasional: <=2 domingos/mes (solo compensatorio); habitual: 3+ o festivo entre semana (recargo + compensatorio)'
    AFTER origen_registro_id;
