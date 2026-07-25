'use strict';

// Turnos dirigidos: un gestor elige a mano los destinatarios de una oferta en
// vez de abrirla al pool completo por cargo certificado. Estas pruebas fijan
// el contrato: crear() exige al menos un destinatario y notifica solo a
// esos usuarios; aplicar() deja postularse a un destinatario directo aunque
// no tenga el cargo certificado (mismo criterio que asignarDirecto), y
// rechaza a cualquiera que no esté en la lista.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/trabajador-empresa/trabajador-empresa.model');
jest.mock('../modules/cargos/cargos.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadorEmpresaModel = require('../modules/trabajador-empresa/trabajador-empresa.model');
const CargosModel = require('../modules/cargos/cargos.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');

afterEach(() => jest.clearAllMocks());

describe('OfertasService.crear — turno dirigido', () => {
  test('rechaza visibilidad dirigida sin trabajador_ids', async () => {
    await expect(
      OfertasService.crear(7, { titulo: 'Evento', visibilidad: 'dirigida', trabajador_ids: [] }, 1)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(OfertasModel.crear).not.toHaveBeenCalled();
  });

  test('con destinatarios válidos, notifica solo a esos usuarios (no al pool por cargo)', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 55 }, { id: 56 }]]); // validarDestinatarios: ambos pertenecen a la empresa
    OfertasModel.crear.mockResolvedValue(1);
    OfertasModel.obtenerPorId.mockResolvedValue({
      id: 1,
      empresa_id: 7,
      titulo: 'Montaje privado',
      fecha: '2026-08-01',
      visibilidad: 'dirigida',
      puestos: [],
      destinatarios: [
        { trabajador_id: 55, usuario_id: 501, nombre: 'Ana', apellido: 'Ruiz' },
        { trabajador_id: 56, usuario_id: 502, nombre: 'Luis', apellido: 'Paz' },
      ],
    });

    const resultado = await OfertasService.crear(
      7,
      { titulo: 'Montaje privado', fecha: '2026-08-01', visibilidad: 'dirigida', trabajador_ids: [55, 56], puestos: [] },
      1
    );

    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [501, 502],
      expect.objectContaining({ tipo: 'oferta.nueva' })
    );
    expect(resultado.visibilidad).toBe('dirigida');
  });
});

describe('OfertasService.aplicar — turno dirigido', () => {
  const ofertaDirigida = {
    id: 9,
    empresa_id: 7,
    estado: 'abierta',
    fecha: '2099-01-01',
    titulo: 'Turno VIP',
    visibilidad: 'dirigida',
    puestos: [{ id: 20, cargo_id: 3, cargo_nombre: 'auxiliar', plazas: 2, plazas_cubiertas: 0 }],
  };

  beforeEach(() => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 99, ranking: null, nombre: 'Ana', apellido: 'Ruiz' });
    OfertasModel.obtenerPorId.mockResolvedValue(ofertaDirigida);
    TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa.mockResolvedValue({ id: 200, estado: 'activo' });
    AsignacionesModel.obtenerPorPuestoYTrabajador.mockResolvedValue(null);
    AsignacionesModel.crear.mockResolvedValue(500);
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 500 });
    pool.query.mockResolvedValue([[]]); // gestores a notificar: ninguno, simplifica el caso feliz
  });

  test('destinatario directo sin cargo certificado puede postularse (bypass confirmado)', async () => {
    OfertasModel.esDestinatario.mockResolvedValue(true);

    const resultado = await OfertasService.aplicar(7, 9, 20, 501, [], { rol: 'trabajador_turnos' });

    expect(CargosModel.tieneAsignacion).not.toHaveBeenCalled();
    expect(AsignacionesModel.crear).toHaveBeenCalledWith(7, 9, 20, 99);
    expect(resultado).toEqual({ id: 500 });
  });

  test('trabajador que no está en la lista de destinatarios → 404', async () => {
    OfertasModel.esDestinatario.mockResolvedValue(false);

    await expect(
      OfertasService.aplicar(7, 9, 20, 999, [], { rol: 'trabajador_turnos' })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(AsignacionesModel.crear).not.toHaveBeenCalled();
  });
});
