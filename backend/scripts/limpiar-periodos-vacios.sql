-- Identify and clean empty periods (periods without any registros_diarios)
-- This fixes the Aug 31 duplicate periods bug

-- Step 1: View all empty periods (no registros_diarios)
SELECT
  pn.id,
  pn.empresa_id,
  pn.fecha_inicio,
  pn.fecha_fin,
  pn.tipo,
  pn.estado,
  pn.created_at,
  COUNT(rd.id) AS num_registros
FROM periodos_nomina pn
LEFT JOIN registros_diarios rd ON rd.periodo_id = pn.id
GROUP BY pn.id
HAVING COUNT(rd.id) = 0
ORDER BY pn.created_at DESC;

-- Step 2: DELETE empty periods (uncomment and run to execute)
-- DELETE FROM periodos_nomina
-- WHERE id IN (
--   SELECT pn.id FROM (
--     SELECT pn.id
--     FROM periodos_nomina pn
--     LEFT JOIN registros_diarios rd ON rd.periodo_id = pn.id
--     GROUP BY pn.id
--     HAVING COUNT(rd.id) = 0
--   ) AS pn
-- );

-- Step 3: Verify deletion (run after step 2)
-- SELECT 'Remaining empty periods after deletion:' as status;
-- SELECT COUNT(*) as empty_periods_remaining
-- FROM periodos_nomina pn
-- LEFT JOIN registros_diarios rd ON rd.periodo_id = pn.id
-- GROUP BY pn.id
-- HAVING COUNT(rd.id) = 0;
