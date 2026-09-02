-- Clean up empty periods created by Aug 31 race condition bug
-- This migration identifies and removes all periods with zero registros_diarios
-- Safe to run multiple times - idempotent operation

DELETE FROM periodos_nomina
WHERE id IN (
  SELECT pn.id FROM (
    SELECT pn.id
    FROM periodos_nomina pn
    WHERE NOT EXISTS (
      SELECT 1 FROM registros_diarios rd
      WHERE rd.periodo_id = pn.id
    )
  ) AS subquery
);
