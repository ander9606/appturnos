-- ============================================================
-- 103 — ofertas_turno.notas_adicionales
--
-- El gestor quiere agregar detalles adicionales al turno (ej. "llevar
-- ropa blanca") que sí debe ver el trabajador, pero que NO deben salir
-- en el contrato PDF — la descripción (`descripcion`) sí llega ahí vía
-- contratos_diarios.descripcion_labor (ver confirmar()/asignarDirecto()
-- en asignaciones.postulacion.model.js), así que mezclar información
-- puramente operativa ahí termina ensuciando el documento legal.
-- `externo_notas` no sirve para esto: son instrucciones para el operario
-- que llegan automáticamente desde logiq360, no un campo que el gestor
-- escriba a mano.
-- ============================================================

ALTER TABLE ofertas_turno
  ADD COLUMN notas_adicionales TEXT NULL
    COMMENT 'Detalles adicionales del turno para el trabajador (ej. qué llevar) — nunca sale en el contrato'
    AFTER descripcion;
