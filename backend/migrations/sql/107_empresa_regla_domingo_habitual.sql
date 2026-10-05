-- Cuándo un domingo trabajado es "habitual" (recargo dominical + compensatorio, Art. 181 CST).
-- 'ley'     = 3.º domingo del mes calendario en adelante (default, regla de la app desde antes).
-- 'dos_meses' = habitual desde 2 meses después del primer domingo trabajado por el trabajador.
-- Solo importa si la empresa suma recargos (sumar_nocturnas_festivo = 1).
ALTER TABLE empresas
  ADD COLUMN regla_domingo_habitual ENUM('ley','dos_meses') NOT NULL DEFAULT 'ley';
