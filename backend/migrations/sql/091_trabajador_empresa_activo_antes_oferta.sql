-- 091 — Recordar si el vínculo ya estaba activo antes de una oferta.
--
-- invitar() puede ofrecer nómina a un trabajador que YA es 'activo' en la
-- empresa (conversión turnos → nómina) — el vínculo pasa a
-- 'solicitado_por_empresa' mientras espera que acepte. Sin esta columna,
-- rechazar()/cancelar esa oferta lo marcaba 'rechazado' igual que una
-- invitación nueva rechazada, cerrando para siempre una relación que ya
-- existía. Con la bandera, rechazar() puede restaurar 'activo' en vez de
-- cerrar el vínculo.

ALTER TABLE trabajador_empresa
  ADD COLUMN activo_antes_de_oferta TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'El vínculo ya estaba activo cuando se le hizo esta oferta (ej. nómina) — si la rechaza, restaurar a activo en vez de cerrar el vínculo.'
    AFTER tipo_ofrecido;
