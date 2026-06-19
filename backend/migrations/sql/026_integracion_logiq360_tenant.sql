-- Migración 026: mapeo explícito tenant_id (logiq360) ↔ empresa_id (App Turnos)
-- Antes el receptor de webhooks asumía empresa_id == tenant_id del payload.
-- El emparejamiento (pairing) ahora persiste el tenant_id real de logiq360 para
-- enrutar los webhooks sin acoplar los IDs.

ALTER TABLE integracion_config
  ADD COLUMN logiq360_tenant_id INT NULL
    COMMENT 'tenant_id en logiq360 — establecido por el emparejamiento' AFTER empresa_id,
  ADD COLUMN logiq360_base_url VARCHAR(500) NULL
    COMMENT 'URL base de logiq360 para consultas pull' AFTER webhook_url;

-- Índice para resolver empresa_id a partir del tenant_id entrante.
CREATE INDEX idx_integracion_logiq360_tenant ON integracion_config (logiq360_tenant_id);
