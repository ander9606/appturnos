'use strict';

// Un trabajador_nomina sin acepta_extras recibía el push "Nueva oferta: ..." igual
// que cualquiera, tocaba la notificación y chocaba contra el 403 de
// validarAceptaExtras sin ninguna explicación. Estos tests verifican que
// notificarPoolPorPuestos/notificarDestinatariosDirectos (disparados desde
// publicar()) ya no le avisan de algo a lo que no puede entrar.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');
const { ROLES } = require('../config/constants');

afterEach(() => jest.clearAllMocks());

function ofertaBase(overrides) {
  return {
    id: 1, empresa_id: 7, titulo: 'Turno extra', fecha: '2026-06-01',
    estado: 'borrador',
    puestos: [{ id: 10, cargo_id: 3, cargo_nombre: 'auxiliar', plazas: 5, tarifa_dia: 80000 }],
    ...overrides,
  };
}

describe('OfertasService.publicar — filtra el aviso por rol y acepta_extras', () => {
  test("para_quien: 'nomina' solo avisa a trabajador_nomina", async () => {
    const oferta = ofertaBase({ para_quien: 'nomina' });
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta).mockResolvedValueOnce(oferta);
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    pool.query.mockResolvedValue([[{ usuario_id: 55 }]]);

    await OfertasService.publicar(7, 1);

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual([7, 3, [ROLES.TRABAJADOR_NOMINA], ROLES.TRABAJADOR_NOMINA]);
  });

  test("para_quien: 'turnos' solo avisa a trabajador_turnos", async () => {
    const oferta = ofertaBase({ para_quien: 'turnos' });
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta).mockResolvedValueOnce(oferta);
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    pool.query.mockResolvedValue([[{ usuario_id: 55 }]]);

    await OfertasService.publicar(7, 1);

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual([7, 3, [ROLES.TRABAJADOR_TURNOS], ROLES.TRABAJADOR_NOMINA]);
  });

  test("para_quien: 'ambos' avisa a los dos roles", async () => {
    const oferta = ofertaBase({ para_quien: 'ambos' });
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta).mockResolvedValueOnce(oferta);
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    pool.query.mockResolvedValue([[{ usuario_id: 55 }]]);

    await OfertasService.publicar(7, 1);

    const [, params] = pool.query.mock.calls[0];
    expect(params[2]).toEqual(expect.arrayContaining([ROLES.TRABAJADOR_NOMINA, ROLES.TRABAJADOR_TURNOS]));
  });

  test('dirigida a un trabajador_nomina sin acepta_extras → no se le notifica', async () => {
    const oferta = ofertaBase({
      visibilidad: 'dirigida',
      destinatarios: [
        { trabajador_id: 20, usuario_id: 200 }, // sin acepta_extras
        { trabajador_id: 21, usuario_id: 201 }, // con acepta_extras (no aparece en la query de exclusión)
      ],
    });
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta).mockResolvedValueOnce(oferta);
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    // Única query de pool.query en este flujo: la de exclusión por acepta_extras.
    pool.query.mockResolvedValue([[{ trabajador_id: 20 }]]);

    await OfertasService.publicar(7, 1);

    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [201],
      expect.objectContaining({ tipo: 'oferta.nueva' })
    );
  });

  test('dirigida y ningún destinatario tiene acepta_extras → no notifica a nadie', async () => {
    const oferta = ofertaBase({
      visibilidad: 'dirigida',
      destinatarios: [{ trabajador_id: 20, usuario_id: 200 }],
    });
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta).mockResolvedValueOnce(oferta);
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    pool.query.mockResolvedValue([[{ trabajador_id: 20 }]]);

    await OfertasService.publicar(7, 1);

    expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
  });
});
