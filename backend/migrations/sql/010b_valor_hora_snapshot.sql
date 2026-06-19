-- ============================================================
-- 010b — Snapshot de valor_hora al cerrar período de nómina
--
-- Problema que resuelve:
--   La liquidación leía tarifa_hora / salario_base del trabajador
--   en el momento de la consulta. Si el sueldo cambiaba después
--   de trabajar el período pero antes de liquidarlo, el cálculo
--   era incorrecto.
--
-- Solución (Opción A):
--   Al cerrar el período se congela el valor_hora de cada
--   trabajador en registros_diarios.valor_hora_snapshot.
--   La liquidación usa el snapshot si está disponible;
--   si es NULL (período aún abierto) hace fallback al sueldo
--   actual (comportamiento previo, solo para períodos vivos).
-- ============================================================

ALTER TABLE registros_diarios
  ADD COLUMN valor_hora_snapshot DECIMAL(10,4) NULL
    COMMENT 'Valor hora congelado al cerrar el período (COP). NULL = período aún abierto.'
  AFTER horas_festivo;
