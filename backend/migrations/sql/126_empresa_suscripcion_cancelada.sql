-- 119 — Cancelación voluntaria de la renovación de la suscripción.
-- No borra ni acorta suscripcion_vigente_hasta: el acceso sigue hasta esa
-- fecha (ya pagada); solo deja de recibir recordatorios de renovación.
ALTER TABLE empresas ADD COLUMN suscripcion_cancelada_at DATETIME NULL DEFAULT NULL;
