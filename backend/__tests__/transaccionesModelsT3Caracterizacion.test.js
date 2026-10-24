'use strict';

// Golden master de las transacciones de CargosModel.reemplazarFunciones, PeriodosModel.cerrarConSnapshot
// y TrabajadoresModel.guardarDisponibilidad / crear, generado con el código ANTES de pasarlas a
// enTransaccion(). Ver __tests__/helpers/transaccionGolden.js.
//
// UNA diferencia intencional: TrabajadoresModel.crear llamaba a conn.beginTransaction() FUERA del
// try, así que si el begin fallaba la conexión NUNCA se devolvía al pool (el finally no corría).
// Con enTransaccion() el begin va dentro del try: se hace rollback y release. Es una fuga corregida.
jest.mock('../config/database', () => ({ pool: { query: jest.fn(), getConnection: jest.fn() } }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { pool } = require('../config/database');
const { verificarGolden, escenariosDe } = require('./helpers/transaccionGolden');
const CargosModel = require('../modules/cargos/cargos.model');
const PeriodosModel = require('../modules/nomina/periodos/periodos.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');

const TRABAJADOR_COMPLETO = {
  nombre: 'Ana', apellido: 'Pérez', cedula: '123', tipo_documento: 'CE', fecha_nacimiento: '1990-01-01', sexo: 'F',
  telefono: '300', email: 'ana@x.com', tipo: 'nomina', cargo: 'Auxiliar', tarifa_hora: 9000, salario_base: 1750905,
  contacto_emergencia_nombre: 'Luis', contacto_emergencia_tel: '301', eps: 'Sanitas', afp: 'Porvenir', banco: 'B',
  tipo_cuenta: 'ahorros', numero_cuenta: '1', direccion: 'cll', ant_judiciales_fecha: '2026-01-01', ant_disciplinarios_fecha: '2026-01-02',
  hora_entrada_esperada: '08:00:00', empresa_ids: [2, 3], cargo_ids: [4], external_ref: 'lq:9', creado_por: 10,
  experiencias: [{ empresa_nombre: 'X', cargo: 'Y', fecha_inicio: '2020-01-01', fecha_fin: '2021-01-01' }, { empresa_nombre: 'Z', cargo: 'W', fecha_inicio: '2021-02-01' }],
  diplomas: [{ titulo: 'Bachiller', institucion: 'Colegio', anio: 2008 }, { titulo: 'Curso', institucion: 'SENA' }],
};

const CASOS = {
  'cargos.reemplazarFunciones (con funciones)': () => CargosModel.reemplazarFunciones(7, 1, ['Armar carpas', 'Cargar camión']),
  'cargos.reemplazarFunciones (lista vacía: solo borra)': () => CargosModel.reemplazarFunciones(7, 1, []),
  'periodos.cerrarConSnapshot': () => PeriodosModel.cerrarConSnapshot(1, 20, 10),
  'trabajadores.guardarDisponibilidad': () => TrabajadoresModel.guardarDisponibilidad(1, 5, [
    { dia_semana: 1, hora_inicio: '08:00', hora_fin: '12:00', activo: true },
    { dia_semana: 2, hora_inicio: '09:00', hora_fin: '17:00', activo: false },
  ]),
  'trabajadores.guardarDisponibilidad (sin slots: ni abre conexión)': () => TrabajadoresModel.guardarDisponibilidad(1, 5, []),
  'trabajadores.crear (completo: experiencias y diplomas)': () => TrabajadoresModel.crear(1, TRABAJADOR_COMPLETO),
  'trabajadores.crear (mínimo)': () => TrabajadoresModel.crear(1, { nombre: 'A', apellido: 'B' }),
};

// Escenarios cuyo resultado cambia a propósito respecto al código original (ver arriba).
const DIFERENCIAS_INTENCIONALES = {
  'trabajadores.crear (completo: experiencias y diplomas)': { falla_begin: ['getConnection', 'begin', 'rollback', 'release'] },
  'trabajadores.crear (mínimo)': { falla_begin: ['getConnection', 'begin', 'rollback', 'release'] },
};

test('las transacciones de cargos, periodos y trabajadores se comportan igual que el golden (éxito y cada falla)', async () => {
  const { escrito, actual, golden } = await verificarGolden(pool, CASOS, 'transaccionesModelsT3.golden.json');
  if (escrito) return;
  expect(Object.keys(actual)).toEqual(Object.keys(golden));
  for (const nombre of Object.keys(golden)) {
    for (const escenario of Object.keys(golden[nombre])) {
      const dif = DIFERENCIAS_INTENCIONALES[nombre]?.[escenario];
      if (dif) {
        // el ORIGINAL no devolvía la conexión: el golden lo conserva como evidencia
        expect(golden[nombre][escenario].log.map((l) => l[0])).toEqual(['getConnection', 'begin']);
        expect(actual[nombre][escenario].log.map((l) => l[0])).toEqual(dif);
        expect(actual[nombre][escenario].error).toBe(golden[nombre][escenario].error); // mismo error hacia afuera
      } else {
        expect({ nombre, escenario, valor: actual[nombre][escenario] }).toEqual({ nombre, escenario, valor: golden[nombre][escenario] });
      }
    }
  }
});

test('forma de la transacción de reemplazarFunciones: la lectura final va DESPUÉS del commit y fuera de la transacción', async () => {
  const esc = await escenariosDe(pool, CASOS['cargos.reemplazarFunciones (con funciones)']);
  expect(esc.ok.log.map((l) => l[0])).toEqual(['getConnection', 'begin', 'query', 'query', 'commit', 'release', 'pool.query']);
  expect(esc.falla_consulta_1.log.map((l) => l[0])).toEqual(['getConnection', 'begin', 'query', 'query', 'rollback', 'release']);
});
