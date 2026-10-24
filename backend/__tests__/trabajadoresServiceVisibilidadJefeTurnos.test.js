'use strict';

// Seguridad: jefe_turnos es un rol operativo de turnos, no de nómina/RRHH —
// no debe poder leer cédula, salario/tarifa, cuenta bancaria ni otros datos
// personales sensibles de GET /api/trabajadores y /:id (antes se devolvían
// todas las columnas sin filtrar por rol).
jest.mock('../modules/trabajadores/trabajadores.model');

const { ROLES } = require('../config/constants');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');

const FICHA = {
  id: 7, empresa_id: 1, usuario_id: 99, nombre: 'Ana', apellido: 'Pérez',
  cedula: '123456789', telefono: '3001234567', email: 'ana@x.com', tipo: 'nomina',
  cargo: 'Auxiliar', salario_base: '1500000', tarifa_hora: null,
  banco: 'Bancolombia', tipo_cuenta: 'ahorros', numero_cuenta: '000111222',
  direccion: 'Calle 1 # 2-3', fecha_nacimiento: '1990-01-01', sexo: 'F',
  ant_judiciales_fecha: '2025-01-01', ant_disciplinarios_fecha: null,
  activo: 1, created_at: '2026-01-01', foto_perfil: null,
};

const JEFE_TURNOS = { sub: 10, rol: ROLES.JEFE_TURNOS };
const ADMIN = { sub: 2, rol: ROLES.ADMIN_EMPRESA };

beforeEach(() => jest.clearAllMocks());

describe('TrabajadoresService.obtener — visibilidad por rol', () => {
  test('jefe_turnos no recibe cédula, salario ni datos bancarios', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ ...FICHA });

    const data = await TrabajadoresService.obtener(1, 7, JEFE_TURNOS);

    expect(data).not.toHaveProperty('cedula');
    expect(data).not.toHaveProperty('salario_base');
    expect(data).not.toHaveProperty('banco');
    expect(data).not.toHaveProperty('tipo_cuenta');
    expect(data).not.toHaveProperty('numero_cuenta');
    expect(data).not.toHaveProperty('direccion');
    expect(data).not.toHaveProperty('ant_judiciales_fecha');
    expect(data).toMatchObject({ nombre: 'Ana', apellido: 'Pérez', telefono: '3001234567', email: 'ana@x.com', cargo: 'Auxiliar' });
  });

  test('admin_empresa sigue viendo la ficha completa', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ ...FICHA });

    const data = await TrabajadoresService.obtener(1, 7, ADMIN);

    expect(data).toMatchObject({ cedula: '123456789', banco: 'Bancolombia', salario_base: '1500000' });
  });
});

describe('TrabajadoresService.listar — visibilidad por rol', () => {
  test('jefe_turnos no recibe cédula ni datos bancarios en el listado', async () => {
    TrabajadoresModel.listar.mockResolvedValue({ data: [{ ...FICHA }], total: 1 });

    const { data } = await TrabajadoresService.listar(1, { page: 1, limit: 20 }, JEFE_TURNOS);

    expect(data[0]).not.toHaveProperty('cedula');
    expect(data[0]).not.toHaveProperty('numero_cuenta');
  });
});
