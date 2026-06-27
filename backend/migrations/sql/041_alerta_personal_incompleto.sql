-- ============================================================
-- 041 — Flag anti-duplicado para alerta de personal incompleto
-- ============================================================
ALTER TABLE ofertas_turno
  ADD COLUMN IF NOT EXISTS alerta_personal_enviada TINYINT(1) NOT NULL DEFAULT 0;