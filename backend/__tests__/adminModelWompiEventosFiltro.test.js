'use strict';

// Caracterización del filtro de listarWompiEventos: combina estado + empresa_id en el
// WHERE sin romper la columna COUNT(*) (que usa el mismo alias we).
jest.mock('../config/database', () => {
  const llamadas = [];
  const ejecutar = async (sql, params) => {
    llamadas.push([sql.replace(/\s+/g, ' ').trim(), params]);
    return [[{ total: 0 }]];
  };
  return { pool: { query: ejecutar }, __llamadas: llamadas };
});

const { __llamadas: llamadas } = require('../config/database');
const AdminModel = require('../modules/admin/admin.model');

beforeEach(() => { llamadas.length = 0; });

describe('AdminModel.listarWompiEventos — filtro', () => {
  test('sin filtros: WHERE vacío', async () => {
    await AdminModel.listarWompiEventos({ limit: 30, offset: 0 });
    const [sql, params] = llamadas[0];
    expect(sql).not.toContain('WHERE');
    expect(params).toEqual([30, 0]);
  });

  test('solo empresa_id: filtra por we.empresa_id', async () => {
    await AdminModel.listarWompiEventos({ empresaId: 8, limit: 30, offset: 0 });
    const [sql, params] = llamadas[0];
    expect(sql).toContain('WHERE we.empresa_id = ?');
    expect(params).toEqual([8, 30, 0]);
  });

  test('estado + empresa_id combinados: AND, en el mismo orden en SELECT y en COUNT', async () => {
    await AdminModel.listarWompiEventos({ estado: 'procesado', empresaId: 8, limit: 10, offset: 0 });
    const [sqlSelect, paramsSelect] = llamadas[0];
    const [sqlCount, paramsCount] = llamadas[1];

    expect(sqlSelect).toContain("WHERE we.estado = ? AND we.empresa_id = ?");
    expect(paramsSelect).toEqual(['procesado', 8, 10, 0]);
    expect(sqlCount).toContain("WHERE we.estado = ? AND we.empresa_id = ?");
    expect(paramsCount).toEqual(['procesado', 8]);
  });
});
