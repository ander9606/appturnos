-- ============================================================
-- 105 — asignaciones_turno.estado: nuevo valor 'por_reconfirmar'
--
-- Editar fecha/hora_inicio/hora_fin_estimada/lugar de una oferta con
-- trabajadores ya 'confirmado' ahora los pasa a 'por_reconfirmar' en vez
-- de solo notificarles (ver OfertasService.actualizar en
-- ofertas.gestion.service.js). Deja de contar en plazas_cubiertas hasta
-- que el propio trabajador reconfirme (vuelve a 'confirmado') o decline
-- (pasa a 'cancelado') — así el gestor puede ver de un vistazo si el
-- cupo sigue realmente cubierto tras el cambio.
-- ============================================================

ALTER TABLE asignaciones_turno
  MODIFY estado ENUM('pendiente','confirmado','en_progreso','completado','no_presentado','cancelado','por_reconfirmar')
  DEFAULT 'pendiente';
