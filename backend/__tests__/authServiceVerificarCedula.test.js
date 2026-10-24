'use strict';

// Seguridad: GET /api/auth/verificar-cedula es público (sin login) — un
// visitante anónimo probando cédulas no debe poder averiguar el nombre de la
// empresa que invitó a esa persona (mapea cédula→empleador). Solo un gestor
// ya autenticado (admin_empresa/jefe_turnos/jefe_nomina, que lo necesitan para
// detectar duplicados al crear/invitar un trabajador) recibe ese nombre.
jest.mock('../modules/auth/auth.model');

const AuthModel = require('../modules/auth/auth.model');
const AuthService = require('../modules/auth/auth.service');

beforeEach(() => jest.clearAllMocks());

describe('AuthService.verificarCedula', () => {
  test('cédula inexistente → solo { existe: false }', async () => {
    AuthModel.verificarCedula.mockResolvedValue(null);
    await expect(AuthService.verificarCedula('999')).resolves.toEqual({ existe: false });
  });

  test('sin invitación pendiente → invitacion: null', async () => {
    AuthModel.verificarCedula.mockResolvedValue({ id: 1, tipo: 'turnos', usuario_id: null, estado_vinculo: null });
    const r = await AuthService.verificarCedula('123');
    expect(r.invitacion).toBeNull();
  });

  test('anónimo (sin verEmpresa): hay invitación pero NUNCA el nombre de la empresa', async () => {
    AuthModel.verificarCedula.mockResolvedValue({
      id: 1, tipo: 'turnos', usuario_id: null, estado_vinculo: 'solicitado_por_empresa', empresa_nombre: 'Acme SAS',
    });
    const r = await AuthService.verificarCedula('123'); // sin opciones → verEmpresa=false por defecto
    expect(r.invitacion).toEqual({ empresa_nombre: undefined });
  });

  test('gestor autenticado (verEmpresa=true): sí recibe el nombre de la empresa', async () => {
    AuthModel.verificarCedula.mockResolvedValue({
      id: 1, tipo: 'turnos', usuario_id: null, estado_vinculo: 'solicitado_por_empresa', empresa_nombre: 'Acme SAS',
    });
    const r = await AuthService.verificarCedula('123', { verEmpresa: true });
    expect(r.invitacion).toEqual({ empresa_nombre: 'Acme SAS' });
  });
});
