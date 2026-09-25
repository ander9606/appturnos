-- Corrección de datos, no de esquema: hasta ahora, usuarios.rol se calculaba
-- a partir de trabajadores.tipo una sola vez, al activar la cuenta, y nunca
-- se revisaba después (ver auth.service.js activarCuenta / ROL_POR_TIPO).
-- Si un gestor cambiaba el tipo de un trabajador ya activado desde "Editar
-- trabajador", la ficha quedaba actualizada pero la cuenta seguía con el rol
-- viejo — el trabajador seguía viendo la interfaz equivocada.
--
-- TrabajadoresService.actualizar ya resincroniza esto hacia adelante en cada
-- edición. Esta migración corrige, una sola vez, a los trabajadores que ya
-- habían cambiado de tipo antes de ese fix y quedaron desincronizados.
UPDATE usuarios u
  JOIN trabajadores t ON t.usuario_id = u.id
  SET u.rol = 'trabajador_nomina'
  WHERE t.tipo = 'nomina' AND u.rol = 'trabajador_turnos';

UPDATE usuarios u
  JOIN trabajadores t ON t.usuario_id = u.id
  SET u.rol = 'trabajador_turnos'
  WHERE t.tipo IN ('turnos', 'ambos') AND u.rol = 'trabajador_nomina';
