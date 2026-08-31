-- Corrección de datos: TrabajadoresService.actualizar permitía cambiar
-- tipo de un trabajador de 'turnos'/'ambos' a 'nomina' vía "Editar
-- trabajador" (PUT /trabajadores/:id) y solo resincronizaba usuarios.rol,
-- nunca usuarios.empresa_id. Un trabajador_turnos tiene empresa_id = NULL
-- por diseño (vive en trabajador_empresa, no atado a una sola empresa), así
-- que la cuenta quedaba con rol 'trabajador_nomina' pero empresa_id NULL:
-- huérfana de empresa (ver Sentry: "Column 'empresa_id' cannot be null" en
-- guardarDisponibilidad, y contratos rotos por el mismo motivo).
--
-- Ese camino directo ahora está bloqueado en TrabajadoresService.actualizar
-- (lanza 409 y exige pasar por la invitación de trabajador-empresa, que sí
-- fija empresa_id). Esta migración corrige, una sola vez, a quienes ya
-- habían quedado huérfanos antes del fix: les asigna el empresa_id de su
-- propia ficha de trabajador tipo 'nomina' (la empresa dueña de esa ficha).
UPDATE usuarios u
  JOIN trabajadores t ON t.usuario_id = u.id AND t.tipo = 'nomina'
  SET u.empresa_id = t.empresa_id
  WHERE u.rol = 'trabajador_nomina' AND u.empresa_id IS NULL;
