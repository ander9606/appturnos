'use strict';

// Un turno de grupo cancelado por fuerza mayor con compensación NO es un cancelado a secas: tiene un costo.
// GruposTurnoModel.turnos() informa cuántos trabajadores quedaron 'fallido' en cada turno.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));

const { pool } = require('../config/database');
const GruposTurnoModel = require('../modules/grupos-turno/grupos-turno.model');

afterEach(() => jest.clearAllMocks());

test('turnos() trae cuántos fallidos tiene cada turno, como número', async () => {
  pool.query.mockResolvedValue([[
    { id: 1, titulo: 'Montaje', estado: 'cancelada', plazas: '3', plazas_cubiertas: '3', fallidos: '2' },
    { id: 2, titulo: 'Desmontaje', estado: 'publicada', plazas: '3', plazas_cubiertas: '1', fallidos: '0' },
  ]]);

  const turnos = await GruposTurnoModel.turnos(7, 10);

  expect(pool.query.mock.calls[0][0]).toMatch(/a\.estado = 'fallido'\) AS fallidos/);
  expect(turnos.map((t) => t.fallidos)).toEqual([2, 0]);
  expect(turnos[0].plazas).toBe(3);
});
