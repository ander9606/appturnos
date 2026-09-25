-- El salario base de un trabajador con sueldo mensual se prorratea por período
-- (liquidacion.service.js) leyendo trabajadores.salario_base en vivo. Si el
-- jefe cambia el salario DESPUÉS de cerrar un período, la liquidación de ese
-- período ya cerrado recalcularía mal con el sueldo nuevo. Igual que
-- valor_hora_snapshot (010b), se congela salario_base_snapshot al cerrar —
-- el cambio de salario solo aplica desde el próximo período abierto en adelante.

ALTER TABLE registros_diarios
  ADD COLUMN salario_base_snapshot DECIMAL(12,2) NULL
  COMMENT 'Salario mensual del trabajador congelado al cerrar el período (COP). NULL = período abierto, o trabajador por tarifa_hora.'
  AFTER valor_hora_snapshot;
