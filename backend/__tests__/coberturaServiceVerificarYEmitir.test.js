'use strict';

// oferta.cubierta era el último evento saliente pendiente de la spec: cuando
// todos los puestos de una oferta originada en logiq360 quedan cubiertos,
// debe avisarse una sola vez (idempotente vía cobertura_notificada).
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/integracion/integracion.service', () => ({ emitir: jest.fn().mockResolvedValue(undefined) }));

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const IntegracionService = require('../modules/integracion/integracion.service');
const CoberturaService = require('../modules/integracion/cobertura.service');

afterEach(() => jest.clearAllMocks());

const ofertaBase = (overrides = {}) => ({
    id: 201, empresa_id: 7, external_ref: 'logiq360:orden:47',
    cobertura_notificada: 0,
    puestos: [
        { cargo_id: 1, plazas: 2, plazas_cubiertas: 2 },
        { cargo_id: 2, plazas: 1, plazas_cubiertas: 1 },
    ],
    ...overrides,
});

describe('CoberturaService.verificarYEmitir', () => {
    test('emite oferta.cubierta cuando todos los puestos están llenos', async () => {
        OfertasModel.obtenerPorId.mockResolvedValue(ofertaBase());
        AsignacionesModel.listarConTrabajadorRef.mockResolvedValue([
            { estado: 'confirmado', trabajador_nombre: 'Pedro', trabajador_apellido: 'Gómez', trabajador_external_ref: 'logiq360:empleado:15', cargo_codigo: 'auxiliar' },
            { estado: 'pendiente', trabajador_nombre: 'Sin confirmar', trabajador_apellido: '', trabajador_external_ref: null, cargo_codigo: 'auxiliar' },
        ]);

        await CoberturaService.verificarYEmitir(7, 201);

        expect(IntegracionService.emitir).toHaveBeenCalledWith(7, 'oferta.cubierta', {
            external_ref: 'logiq360:orden:47',
            cupos_requeridos: 3,
            cupos_cubiertos: 3,
            trabajadores: [
                { nombre: 'Pedro Gómez', external_ref: 'logiq360:empleado:15', rol: 'auxiliar' },
            ],
        });
        expect(OfertasModel.marcarCoberturaNotificada).toHaveBeenCalledWith(7, 201);
    });

    test('no emite si algún puesto sigue con plazas libres', async () => {
        OfertasModel.obtenerPorId.mockResolvedValue(ofertaBase({
            puestos: [{ cargo_id: 1, plazas: 2, plazas_cubiertas: 1 }],
        }));

        await CoberturaService.verificarYEmitir(7, 201);

        expect(IntegracionService.emitir).not.toHaveBeenCalled();
        expect(OfertasModel.marcarCoberturaNotificada).not.toHaveBeenCalled();
    });

    test('no reemite si ya se notificó (idempotencia)', async () => {
        OfertasModel.obtenerPorId.mockResolvedValue(ofertaBase({ cobertura_notificada: 1 }));

        await CoberturaService.verificarYEmitir(7, 201);

        expect(IntegracionService.emitir).not.toHaveBeenCalled();
    });

    test('no emite si la oferta no vino de logiq360 (sin external_ref)', async () => {
        OfertasModel.obtenerPorId.mockResolvedValue(ofertaBase({ external_ref: null }));

        await CoberturaService.verificarYEmitir(7, 201);

        expect(IntegracionService.emitir).not.toHaveBeenCalled();
    });

    test('sin puestos, no emite nada', async () => {
        OfertasModel.obtenerPorId.mockResolvedValue(ofertaBase({ puestos: [] }));

        await CoberturaService.verificarYEmitir(7, 201);

        expect(IntegracionService.emitir).not.toHaveBeenCalled();
    });

    test('un fallo al consultar la oferta no propaga (best-effort)', async () => {
        OfertasModel.obtenerPorId.mockRejectedValue(new Error('db caída'));

        await expect(CoberturaService.verificarYEmitir(7, 201)).resolves.toBeUndefined();
    });
});
