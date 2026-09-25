-- 096: índice único que respalda a nivel de base de datos la regla de "un
-- trabajador no puede tener dos compensatorios asignados el mismo día".
--
-- Antes solo la validaba la aplicación (existeFechaAsignada en
-- compensatorios.service.js#validarFechaDescanso), dejando una ventana de
-- carrera entre el check y el UPDATE: dos asignaciones casi simultáneas para
-- el mismo trabajador podían pasar el check antes de que cualquiera de las
-- dos escribiera. En MySQL los NULL no colisionan en un índice único, así
-- que los descansos 'pendiente' (fecha_asignada IS NULL) conviven sin
-- problema entre sí — el índice solo actúa una vez que ambos tienen fecha.
ALTER TABLE descansos_compensatorios
  ADD UNIQUE KEY uq_compensatorio_trabajador_fecha (empresa_id, trabajador_id, fecha_asignada);
