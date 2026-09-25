-- ============================================================
-- 094 — Cargos de interés declarados por el trabajador al solicitar
-- El trabajador ve el catálogo de cargos de la empresa en el directorio
-- y puede marcar los que le interesan al enviar la solicitud de vínculo.
-- Es solo una señal para el gestor — al aprobar sigue eligiendo qué
-- cargo(s) certificar (solicitudes.tsx: modal "Asignar cargos"), puede
-- ignorar o quitar cualquiera de los premarcados.
-- ============================================================

ALTER TABLE trabajador_empresa
  ADD COLUMN cargos_interes JSON NULL
    COMMENT 'IDs de cargos que el trabajador marcó como interés al solicitar — no certifica nada'
    AFTER tipo_ofrecido;
