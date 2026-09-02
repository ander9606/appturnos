-- Clean up empty periods created by Aug 31 race condition bug
-- This migration identifies and removes all periods with zero registros_diarios
-- Safe to run multiple times - idempotent operation

DELETE pn FROM periodos_nomina pn
LEFT JOIN registros_diarios rd ON rd.periodo_id = pn.id
GROUP BY pn.id
HAVING COUNT(rd.id) = 0;
