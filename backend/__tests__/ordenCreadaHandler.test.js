'use strict';

// Verifica que el handler de orden.creada mapea al payload completo que
// logiq360 ahora envía (latitud/longitud, hora_fin, valor_dia_sugerido,
// notas_para_operario, cupos_custodio) — antes de la integración real estos
// campos casi nunca llegaban poblados desde el otro lado.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/turnos/ofertas/ofertas.model');

const { pool } = require('../config/database');
const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const { procesar } = require('../modules/integracion/entrantes.handlers');

afterEach(() => jest.clearAllMocks());

describe('entrantes.handlers — orden.creada', () => {
  test('mapea latitud/longitud/hora_fin/valor_dia_sugerido/notas_para_operario/custodio', async () => {
    OfertasModel.obtenerPorExternalRef.mockResolvedValue(null);
    pool.query
      .mockResolvedValueOnce([[{ id: 101 }]]) // cargoAuxiliarId()
      .mockResolvedValueOnce([[{ id: 102 }]]); // cargoCustodioId()

    const data = {
      external_ref: 'logiq360:orden:47',
      alquiler_ref: 'logiq360:alquiler:31',
      tipo: 'montaje',
      fecha: '2026-06-01',
      hora_inicio: '06:00:00',
      hora_fin: '16:00:00',
      direccion: 'Finca El Refugio',
      ciudad: 'Chía',
      latitud: 4.8567,
      longitud: -74.0124,
      notas_para_operario: 'Llegar antes de las 6am',
      cupos_gig: 5,
      valor_dia_sugerido: 80000,
      cupos_custodio: 1,
      valor_dia_custodio: 120000,
      productos_resumen: [],
    };

    const manejado = await procesar('orden.creada', 7, data);

    expect(manejado).toBe(true);
    expect(OfertasModel.crear).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        fecha: '2026-06-01',
        hora_inicio: '06:00:00',
        hora_fin_estimada: '16:00:00',
        lugar: 'Finca El Refugio, Chía',
        latitud: 4.8567,
        longitud: -74.0124,
        externo_notas: 'Llegar antes de las 6am',
        external_ref: 'logiq360:orden:47',
        alquiler_ref: 'logiq360:alquiler:31',
        estado: 'borrador',
        puestos: [
          expect.objectContaining({ cargo_id: 101, plazas: 5, tarifa_dia: 80000 }),
          expect.objectContaining({ cargo_id: 102, plazas: 1, tarifa_dia: 120000 }),
        ],
      }),
      null
    );
  });

  test('idempotente: si ya existe oferta con ese external_ref, no la vuelve a crear', async () => {
    OfertasModel.obtenerPorExternalRef.mockResolvedValue({ id: 1 });

    await procesar('orden.creada', 7, { external_ref: 'logiq360:orden:47' });

    expect(OfertasModel.crear).not.toHaveBeenCalled();
  });

  test('sin cupos_gig ni cupos_custodio, crea la oferta sin puestos (el jefe los agrega manualmente)', async () => {
    OfertasModel.obtenerPorExternalRef.mockResolvedValue(null);

    await procesar('orden.creada', 7, { external_ref: 'logiq360:orden:48', fecha: '2026-06-02' });

    expect(OfertasModel.crear).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ puestos: [] }),
      null
    );
    expect(pool.query).not.toHaveBeenCalled(); // no resuelve cargos si no hay cupos
  });
});
