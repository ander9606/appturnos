'use strict';

// rangoDisponible() calcula los 28 días candidatos (plazo legal, Art. 179
// CST) que la app muestra coloreados en el picker de asignación manual —
// verde/ámbar/rojo por cercanía, y marca no disponibles los días ya
// ocupados (otro registro, otro compensatorio) o que caen en domingo/festivo.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../utils/laboralUtils', () => ({ esDiaFestivo: jest.fn() }));

const { pool } = require('../config/database');
const { esDiaFestivo } = require('../utils/laboralUtils');
const CompensatoriosModel = require('../modules/nomina/compensatorios/compensatorios.model');

const EMPRESA_ID = 3;
const TRABAJADOR_ID = 54;

beforeEach(() => {
  jest.clearAllMocks();
  esDiaFestivo.mockReturnValue(false);
  pool.query.mockResolvedValue([[]]);
});

describe('CompensatoriosModel.rangoDisponible', () => {
  test('devuelve los 28 días, con las zonas en los límites correctos', async () => {
    const dias = await CompensatoriosModel.rangoDisponible(EMPRESA_ID, TRABAJADOR_ID, '2026-06-21');

    expect(dias).toHaveLength(28);
    expect(dias[0]).toMatchObject({ fecha: '2026-06-22', zona: 'verde' });
    expect(dias[8]).toMatchObject({ fecha: '2026-06-30', zona: 'verde' });  // día 9
    expect(dias[9]).toMatchObject({ fecha: '2026-07-01', zona: 'ambar' }); // día 10
    expect(dias[18]).toMatchObject({ fecha: '2026-07-10', zona: 'ambar' }); // día 19
    expect(dias[19]).toMatchObject({ fecha: '2026-07-11', zona: 'rojo' });  // día 20
    expect(dias[27]).toMatchObject({ fecha: '2026-07-19', zona: 'rojo' });  // día 28
    expect(dias.every(d => d.disponible)).toBe(true);
  });

  test('un día con registro real queda no disponible', async () => {
    pool.query
      .mockResolvedValueOnce([[{ fecha: '2026-06-25' }]]) // registros_diarios
      .mockResolvedValueOnce([[]]);                        // descansos_compensatorios

    const dias = await CompensatoriosModel.rangoDisponible(EMPRESA_ID, TRABAJADOR_ID, '2026-06-21');

    expect(dias.find(d => d.fecha === '2026-06-25').disponible).toBe(false);
    // el resto sigue disponible — la ocupación es puntual, no tumba todo el rango
    expect(dias.find(d => d.fecha === '2026-06-24').disponible).toBe(true);
  });

  test('un día ya asignado a otro compensatorio queda no disponible', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ fecha: '2026-06-26' }]]);

    const dias = await CompensatoriosModel.rangoDisponible(EMPRESA_ID, TRABAJADOR_ID, '2026-06-21');

    expect(dias.find(d => d.fecha === '2026-06-26').disponible).toBe(false);
  });

  test('domingo/festivo dentro del rango queda no disponible', async () => {
    esDiaFestivo.mockImplementation((fecha) => fecha === '2026-06-28');

    const dias = await CompensatoriosModel.rangoDisponible(EMPRESA_ID, TRABAJADOR_ID, '2026-06-21');

    expect(dias.find(d => d.fecha === '2026-06-28').disponible).toBe(false);
  });

  test('consulta el rango correcto: día 1 a día 28 desde origenFecha', async () => {
    await CompensatoriosModel.rangoDisponible(EMPRESA_ID, TRABAJADOR_ID, '2026-06-21');

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual([EMPRESA_ID, TRABAJADOR_ID, '2026-06-22', '2026-07-19']);
  });
});
