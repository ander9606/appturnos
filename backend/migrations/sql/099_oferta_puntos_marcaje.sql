-- ============================================================
-- 099 — puntos de marcaje zonal específicos por turno/oferta
--
-- Hoy 'zonal' valida contra TODOS los puntos zonales activos de la
-- empresa, sin importar el turno — demasiado laxo (se puede marcar
-- desde cualquier bodega de la empresa) o demasiado rígido si se
-- endurece (un trabajador que apoya en otro punto legítimo queda
-- bloqueado). `oferta_puntos_marcaje` deja que el gestor acote, por
-- turno, cuáles puntos zonales son válidos. Vacía para una oferta =
-- sin restricción (cae al comportamiento actual, sin migrar nada).
-- ============================================================

CREATE TABLE oferta_puntos_marcaje (
  id INT PRIMARY KEY AUTO_INCREMENT,
  oferta_id INT NOT NULL,
  punto_marcaje_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_oferta_punto (oferta_id, punto_marcaje_id),
  INDEX idx_opm_punto (punto_marcaje_id),
  FOREIGN KEY (oferta_id) REFERENCES ofertas_turno(id) ON DELETE CASCADE,
  FOREIGN KEY (punto_marcaje_id) REFERENCES puntos_marcaje(id) ON DELETE CASCADE
) ENGINE=InnoDB;
