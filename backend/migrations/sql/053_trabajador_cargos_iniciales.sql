-- ============================================================
-- 053 — Cargos certificados pre-seleccionados al crear trabajador
-- Al crear la ficha de un trabajador, el admin puede certificarlo ya
-- para ciertos cargos de su catálogo. Como trabajador_cargos cuelga de
-- trabajador_empresa (que requiere usuario_id, inexistente hasta que
-- el trabajador activa su cuenta por cédula), se guardan acá y se
-- aplican en ese momento — mismo patrón que empresas_postulacion.
--
-- creado_por: quién dio de alta la ficha — trabajador_cargos.asignado_por
-- es NOT NULL, y al activar la cuenta (posiblemente días después, en
-- otra sesión) no hay ningún gestor "actuando" al que atribuírselo.
-- ============================================================

ALTER TABLE trabajadores
  ADD COLUMN cargos_iniciales JSON NULL
    COMMENT 'IDs de cargos a certificar en la empresa dueña al activar cuenta'
    AFTER empresas_postulacion,
  ADD COLUMN creado_por INT NULL
    COMMENT 'usuarios.id del gestor que creó esta ficha (para atribuir cargos_iniciales al activar)'
    AFTER external_ref,
  ADD FOREIGN KEY fk_trabajadores_creado_por (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL;
