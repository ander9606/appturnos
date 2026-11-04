import { validateStep1 } from '../features/equipo/perfil/utils';
import { INITIAL } from '../features/equipo/perfil/types';

// Crear un empleado sin tocar el selector de tipo lo dejaba como "turnos": una empresa de
// nómina terminaba con su personal en el circuito equivocado. Ahora el tipo no tiene valor
// por defecto y el paso 1 no avanza sin elegirlo.
describe('nuevo trabajador: el tipo se elige a conciencia', () => {
  const datos = { ...INITIAL, nombre: 'Ana', apellido: 'Pérez', cedula: '1020304050' };

  it('no trae tipo preseleccionado', () => {
    expect(INITIAL.tipo).toBe('');
  });

  it('sin elegir el tipo no deja continuar', () => {
    expect(validateStep1(datos)).toBe('Elige si es un empleado de turnos o de nómina');
  });

  it('con el tipo elegido, continúa', () => {
    expect(validateStep1({ ...datos, tipo: 'nomina' })).toBeNull();
    expect(validateStep1({ ...datos, tipo: 'turnos' })).toBeNull();
  });
});
