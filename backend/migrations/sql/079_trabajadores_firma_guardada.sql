-- ============================================================
-- 079 — Firma guardada del trabajador
--
-- Guarda la última firma digital que el trabajador dibujó (en egreso o al
-- firmar un contrato) para poder reutilizarla como atajo la próxima vez que
-- deba firmar un contrato — evita redibujar el trazo cada vez. Sigue
-- requiriendo un toque explícito por contrato (no se auto-firma nada solo).
-- ============================================================

ALTER TABLE trabajadores
  ADD COLUMN firma_guardada TEXT NULL
    COMMENT 'Última firma digital dibujada por el trabajador, reutilizable en futuros contratos';
