-- ============================================================
-- 052 — Cargo de sistema 'custodio'
--
-- La integración logiq360 (entrantes.handlers.js) reutilizaba el cargo
-- 'auxiliar' para los cupos de custodio/logística del evento, mezclando
-- ambos roles en reportes y en la vista de puestos. Se agrega un cargo
-- de sistema dedicado, con el mismo patrón idempotente de 016_cargos_sistema.
-- ============================================================

INSERT IGNORE INTO cargos (empresa_id, codigo, nombre, descripcion) VALUES
  (NULL, 'custodio',
    'Custodio de evento',
    'Logística y custodia de equipos/material durante el evento — aplica a trabajadores nómina y gig');
