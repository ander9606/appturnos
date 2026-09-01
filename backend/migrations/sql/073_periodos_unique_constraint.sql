-- Prevent duplicate open periods with same date range for the same company.
-- This prevents race conditions when multiple workers mark entrada simultaneously.
ALTER TABLE periodos_nomina
ADD UNIQUE KEY uk_periodo_fecha_empresa (empresa_id, fecha_inicio, fecha_fin);
