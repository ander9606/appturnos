'use strict';

// Contrato público de RegistrosService: los controllers y otros services (empresas, periodos) lo consumen por estos
// nombres. Si el service se reparte en sub-services (como asignaciones y ofertas), la fachada debe seguir exportando
// exactamente esto: ni un método menos ni uno privado de más.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));

const RegistrosService = require('../modules/nomina/registros/registros.service');

const METODOS_PUBLICOS = [
  // gestión
  'obtener', 'listar', 'descartarSospechoso', 'crear', 'rellenarDiasVaciosComoDescanso', 'corregir', 'reprocesarPeriodoAbierto',
  // marcaje del trabajador
  'obtenerMiPerfil', 'marcarEntrada', 'marcarSalida',
  // reingreso
  'solicitarReingreso', 'listarReingresosPendientes', 'aprobarReingreso', 'rechazarReingreso',
];

test('exporta exactamente los 14 métodos públicos, sin helpers privados', () => {
  expect(Object.keys(RegistrosService).sort()).toEqual([...METODOS_PUBLICOS].sort());
});

test.each(METODOS_PUBLICOS)('%s es una función', (nombre) => {
  expect(typeof RegistrosService[nombre]).toBe('function');
});

test('los consumidores externos resuelven lo que usan', () => {
  const periodos = require('../modules/nomina/registros/registros.controller');
  expect(typeof periodos).toBe('object'); // el controller carga con la fachada sin fallar
  expect(typeof RegistrosService.reprocesarPeriodoAbierto).toBe('function'); // usado por empresas.service
  expect(typeof RegistrosService.rellenarDiasVaciosComoDescanso).toBe('function'); // usado por periodos.service
});
