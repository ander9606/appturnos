-- ============================================================
-- 058 — turnos dirigidos (destinatarios elegidos a mano)
--
-- Hoy una oferta siempre se ofrece al pool completo de trabajadores con el
-- cargo certificado (notificarPoolPorPuestos). Un cliente pidio poder, a
-- veces, elegir el mismo a que personas especificas se les ofrece el turno
-- en vez de abrirlo a todo el pool. `visibilidad = 'dirigida'` + la lista en
-- `oferta_destinatarios` reemplazan, para esa oferta, tanto el filtro de
-- cargo certificado como el delay de visibilidad por ranking (mismo criterio
-- que ya usa asignarDirecto: si el gestor elige a la persona a mano, se salta
-- el filtro automatico).
-- ============================================================

ALTER TABLE ofertas_turno
  ADD COLUMN visibilidad ENUM('abierta','dirigida') NOT NULL DEFAULT 'abierta' AFTER para_quien;

CREATE TABLE oferta_destinatarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  oferta_id INT NOT NULL,
  trabajador_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_oferta_trabajador (oferta_id, trabajador_id),
  INDEX idx_od_trabajador (trabajador_id),
  FOREIGN KEY (oferta_id) REFERENCES ofertas_turno(id) ON DELETE CASCADE,
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id) ON DELETE CASCADE
) ENGINE=InnoDB;
