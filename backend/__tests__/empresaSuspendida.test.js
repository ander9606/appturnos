'use strict';

const { aplicarEmpresaSuspendida } = require('../utils/empresaSuspendida');

test('rol con empresa fija suspendida → 403', () => {
  expect(() => aplicarEmpresaSuspendida({ empresa_id: 1, empresa_activo: 0, rol: 'jefe_turnos' }))
    .toThrow(expect.objectContaining({ statusCode: 403 }));
});

test('trabajador_turnos con empresa de origen suspendida → pasa, sin empresa fija', () => {
  const r = aplicarEmpresaSuspendida({ empresa_id: 1, empresa_activo: 0, rol: 'trabajador_turnos' });
  expect(r.empresa_id).toBeNull();
});

test('empresa activa o sin empresa → no cambia nada', () => {
  const a = { empresa_id: 1, empresa_activo: 1, rol: 'jefe_turnos' };
  const b = { empresa_id: null, empresa_activo: null, rol: 'trabajador_turnos' };
  expect(aplicarEmpresaSuspendida(a)).toBe(a);
  expect(aplicarEmpresaSuspendida(b)).toBe(b);
});
