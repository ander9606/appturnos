-- Régimen de contratación de la empresa.
-- 'laboral' calcula descuentos de ley (salud/pensión) en la liquidación de nómina.
-- 'prestacion_servicios' no aplica descuentos aquí (autoliquidación del independiente,
-- fuera del alcance de esta app por ahora).
ALTER TABLE empresas
  ADD COLUMN tipo_contrato ENUM('laboral','prestacion_servicios')
    NOT NULL DEFAULT 'laboral';
