-- 047 — Corrige empresa_id NULL en usuarios trabajador_turnos del seed plataforma-prueba
-- (bug en seed-plataforma-turnos.js: insertaba empresa_id: null en vez de la empresa real)
UPDATE usuarios
SET empresa_id = (SELECT id FROM empresas WHERE nombre LIKE 'Plataforma de Prueba%' LIMIT 1)
WHERE email IN (
  'luis.herrera@plataforma-prueba.co',
  'sofia.reyes@plataforma-prueba.co',
  'camilo.torres@plataforma-prueba.co'
) AND empresa_id IS NULL;
