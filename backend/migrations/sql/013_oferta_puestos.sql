-- ============================================================
-- 013 — Puestos por oferta (cargo + plazas + tarifa propios)
-- Ref: APP-TURNOS-SPEC/02-BASE-DATOS.md §Migración 013, 03-API-ENDPOINTS.md §Turnos.
--
-- Una oferta de turno ahora agrupa N puestos. Cada puesto fija su propio
-- cargo, número de plazas y tarifa. Ej: un montaje puede tener
-- 10 plazas @auxiliar $80k + 2 plazas @jefe_montaje $150k + 1 @conductor $120k.
--
-- Implica eliminar columnas duplicadas de `ofertas_turno` (`plazas_*`,
-- `tarifa_dia`) y agregar `asignaciones_turno.puesto_id` para que cada
-- postulación apunte a un slot concreto.
--
-- Backfill: cada oferta existente se traduce a "1 puesto auxiliar" con
-- los valores actuales. Esto preserva el historial y deja a las empresas
-- libres de editar puestos cuando lo necesiten.
-- ============================================================

-- 1) Tabla de puestos -----------------------------------------------------
CREATE TABLE IF NOT EXISTS oferta_puestos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  oferta_id        INT NOT NULL,
  cargo_id         INT NOT NULL,
  plazas           INT NOT NULL DEFAULT 1,
  plazas_cubiertas INT NOT NULL DEFAULT 0,
  tarifa_dia       DECIMAL(10,2) NOT NULL,
  notas            VARCHAR(255) NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_oferta_cargo (oferta_id, cargo_id),
  KEY idx_cargo (cargo_id),
  FOREIGN KEY (oferta_id) REFERENCES ofertas_turno(id) ON DELETE CASCADE,
  FOREIGN KEY (cargo_id)  REFERENCES cargos(id)
) ENGINE=InnoDB
  COMMENT='Slots (cargo + plazas + tarifa) que componen una oferta de turno';

-- 2) Backfill: 1 puesto "auxiliar" por oferta existente -------------------
-- Si por alguna razón no existe el cargo de sistema 'auxiliar', el INSERT
-- falla en la FK — es lo que queremos: la migración 012 debe haber corrido.
INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, plazas_cubiertas, tarifa_dia)
SELECT o.id,
       (SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo = 'auxiliar' LIMIT 1),
       o.plazas_disponibles,
       o.plazas_cubiertas,
       o.tarifa_dia
FROM ofertas_turno o;

-- 3) Vínculo asignación → puesto -----------------------------------------
ALTER TABLE asignaciones_turno
  ADD COLUMN puesto_id INT NULL AFTER oferta_id;

-- Cada asignación apunta al único puesto de su oferta (post-backfill).
UPDATE asignaciones_turno a
JOIN oferta_puestos p ON p.oferta_id = a.oferta_id
SET a.puesto_id = p.id
WHERE a.puesto_id IS NULL;

-- Ahora sí, el puesto pasa a ser obligatorio + FK.
ALTER TABLE asignaciones_turno
  MODIFY puesto_id INT NOT NULL,
  ADD CONSTRAINT fk_asignacion_puesto
    FOREIGN KEY (puesto_id) REFERENCES oferta_puestos(id),
  ADD KEY idx_puesto (puesto_id);

-- 4) Eliminar columnas obsoletas de ofertas_turno -----------------------
-- A partir de aquí, `plazas` y `tarifa` son agregados sobre `oferta_puestos`.
ALTER TABLE ofertas_turno
  DROP COLUMN plazas_disponibles,
  DROP COLUMN plazas_cubiertas,
  DROP COLUMN tarifa_dia;
