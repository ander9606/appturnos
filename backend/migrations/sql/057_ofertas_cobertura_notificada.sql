-- 057: bandera de idempotencia para el evento oferta.cubierta
--
-- Sin esto, cada nueva confirmación posterior a que la oferta ya estuviera
-- 100% cubierta (ej: se agrega un puesto nuevo y se vuelve a cubrir)
-- reemitiría el evento hacia logiq360. Mismo patrón que
-- ofertas_turno.alerta_personal_enviada.
ALTER TABLE ofertas_turno
  ADD COLUMN cobertura_notificada TINYINT(1) NOT NULL DEFAULT 0 AFTER alerta_personal_enviada;
