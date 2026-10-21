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

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');
const { ROLES } = require('../config/constants');

afterEach(() => jest.clearAllMocks());

function ofertaBase(overrides) {
  return {
    id: 1, empresa_id: 7, titulo: 'Turno extra', fecha: '2026-06-01',
    estado: 'borrador', created_at: '2026-05-30 10:00:00',
    puestos: [{ id: 10, cargo_id: 3, cargo_nombre: 'auxiliar', plazas: 5, tarifa_dia: 80000 }],
    ...overrides,
  };
}

describe('OfertasService.publicar — filtra el aviso por rol y acepta_extras', () => {
  test("para_quien: 'nomina' solo avisa a trabajador_nomina", async () => {
    const oferta = ofertaBase({ para_quien: 'nomina' });
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta).mockResolvedValueOnce(oferta);
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    OfertasModel.listarCandidatosPendientesDeAviso.mockResolvedValue([{ usuario_id: 55 }]);

    await OfertasService.publicar(7, 1);

    // Llega la empresa, la oferta (created_at para el delay de ranking, id para no duplicar notificados),
    // el puesto (cargo_id e id) y los roles a avisar.
    expect(OfertasModel.listarCandidatosPendientesDeAviso).toHaveBeenCalledWith(7, oferta, oferta.puestos[0], [ROLES.TRABAJADOR_NOMINA]);
  });

  test("para_quien: 'turnos' solo avisa a trabajador_turnos", async () => {
    const oferta = ofertaBase({ para_quien: 'turnos' });
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta).mockResolvedValueOnce(oferta);
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    OfertasModel.listarCandidatosPendientesDeAviso.mockResolvedValue([{ usuario_id: 55 }]);

    await OfertasService.publicar(7, 1);

    expect(OfertasModel.listarCandidatosPendientesDeAviso).toHaveBeenCalledWith(7, oferta, oferta.puestos[0], [ROLES.TRABAJADOR_TURNOS]);
  });

  test("para_quien: 'ambos' avisa a los dos roles", async () => {
    const oferta = ofertaBase({ para_quien: 'ambos' });
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta).mockResolvedValueOnce(oferta);
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    OfertasModel.listarCandidatosPendientesDeAviso.mockResolvedValue([{ usuario_id: 55 }]);

    await OfertasService.publicar(7, 1);

    const roles = OfertasModel.listarCandidatosPendientesDeAviso.mock.calls[0][3];
    expect(roles).toEqual(expect.arrayContaining([ROLES.TRABAJADOR_NOMINA, ROLES.TRABAJADOR_TURNOS]));
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
    // Única consulta de este flujo: la de exclusión por acepta_extras.
    OfertasModel.trabajadorIdsNominaSinExtras.mockResolvedValue([20]);

    await OfertasService.publicar(7, 1);

    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [201],
      expect.objectContaining({ tipo: 'oferta.nueva' })
    );
  });

  test('no vuelve a avisar sobre un puesto ya lleno (relevante en el barrido periódico, oferta con varios puestos)', async () => {
    // Regresión: notificarPoolPorPuestos recorría TODOS los puestos sin mirar
    // plazas_cubiertas — en el reintento periódico (turnos.worker.js), un puesto
    // ya lleno seguía avisando a quien recién le tocaba por ranking, para un
    // puesto al que ya no podía postularse.
    const oferta = ofertaBase({
      para_quien: 'ambos',
      puestos: [
        { id: 10, cargo_id: 3, cargo_nombre: 'mesero', plazas: 2, plazas_cubiertas: 2, tarifa_dia: 80000 },
        { id: 11, cargo_id: 4, cargo_nombre: 'cocinero', plazas: 1, plazas_cubiertas: 0, tarifa_dia: 90000 },
      ],
    });
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta).mockResolvedValueOnce(oferta);
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    OfertasModel.listarCandidatosPendientesDeAviso.mockResolvedValue([{ usuario_id: 55 }]);

    await OfertasService.publicar(7, 1);

    expect(OfertasModel.listarCandidatosPendientesDeAviso).toHaveBeenCalledTimes(1);
    const puestoConsultado = OfertasModel.listarCandidatosPendientesDeAviso.mock.calls[0][2];
    expect(puestoConsultado.cargo_id).toBe(4); // cargo_id del puesto 'cocinero', no del 'mesero' lleno
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledTimes(1);
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [55],
      expect.objectContaining({ titulo: 'Nueva oferta: cocinero' })
    );
  });

  test('el aviso al pool respeta el delay de visibilidad por ranking y no duplica notificados', async () => {
    // Regresión del bug reportado: antes esta query no miraba ranking ni si
    // ya se había notificado, así que trabajadores de ranking bajo recibían
    // el push antes de poder postularse (bloqueados con 404 por delayPorRanking).
    const oferta = ofertaBase({ para_quien: 'ambos' });
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta).mockResolvedValueOnce(oferta);
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    OfertasModel.listarCandidatosPendientesDeAviso.mockResolvedValue([{ usuario_id: 55 }]);

    await OfertasService.publicar(7, 1);

    // El delay por ranking y el NOT EXISTS viven en el SQL del model: los fija
    // ofertasGestionConsultasCaracterizacion.test.js. Aquí se comprueba que el service le
    // entrega lo que necesita para aplicarlos (created_at de la oferta, e ids de oferta y puesto).
    expect(OfertasModel.listarCandidatosPendientesDeAviso).toHaveBeenCalledWith(7, oferta, oferta.puestos[0], expect.any(Array));
    expect(oferta.created_at).toBe('2026-05-30 10:00:00');
  });

  test('dirigida y ningún destinatario tiene acepta_extras → no notifica a nadie', async () => {
    const oferta = ofertaBase({
      visibilidad: 'dirigida',
      destinatarios: [{ trabajador_id: 20, usuario_id: 200 }],
    });
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta).mockResolvedValueOnce(oferta);
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    OfertasModel.trabajadorIdsNominaSinExtras.mockResolvedValue([20]);

    await OfertasService.publicar(7, 1);

    expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
  });
});
