-- ============================================================
-- 127 — Quita el UNIQUE (oferta_id, trabajador_id) de asignaciones_turno
-- Viene de antes de que existieran los puestos (mig. 004, previa a la 013):
-- en ese entonces una oferta tenía un solo cargo, así que un trabajador
-- solo podía tener una fila por oferta. Hoy la unidad real es el puesto
-- (`puesto_id`), y esta llave vieja sigue bloqueando dos casos legítimos:
-- postularse a un segundo puesto de la misma oferta, y volver a postularse
-- al mismo puesto tras cancelar (el chequeo de duplicado en la app ya
-- ignora 'cancelado' — ver obtenerPorPuestoYTrabajador — pero el INSERT
-- seguía chocando con esta llave a nivel de base de datos).
-- ============================================================

-- La FK de oferta_id necesita algún índice que la respalde; se agrega uno
-- plano antes de soltar el único, si no MySQL rechaza el DROP.
ALTER TABLE asignaciones_turno ADD INDEX idx_oferta (oferta_id);
ALTER TABLE asignaciones_turno DROP INDEX uk_asignacion;
