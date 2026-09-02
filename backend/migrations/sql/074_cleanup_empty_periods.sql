-- Clean up empty periods created by Aug 31 race condition bug
-- This migration identifies and removes all periods with zero registros_diarios
-- Safe to run multiple times - idempotent operation

DELETE FROM periodos_nomina
WHERE id IN (
  SELECT pn.id FROM (
    SELECT pn.id
    FROM periodos_nomina pn
    LEFT JOIN registros_diarios rd ON rd.periodo_id = pn.id
    GROUP BY pn.id
    HAVING COUNT(rd.id) = 0
  ) AS pn
);

-- Log the cleanup (optional - for auditing)
-- This will show in migration logs that empty periods were cleaned
SELECT CONCAT('Cleaned up empty periods on ', NOW()) AS cleanup_status;
