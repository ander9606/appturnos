import { turnosSolapan } from '@/features/turnos/pestana/turnosPestana';
import type { Asignacion, Oferta } from '@api-client';

const oferta = (o: Partial<Oferta>) =>
  ({ fecha: '2026-06-01', hora_inicio: '09:00:00', hora_fin_estimada: '17:00:00', fin_dia_siguiente: 0, ...o }) as Oferta;
const turno = (o: Partial<Asignacion>) =>
  ({ oferta_fecha: '2026-06-01', hora_inicio: '09:00:00', hora_fin_estimada: '17:00:00', fin_dia_siguiente: 0, ...o }) as Asignacion;

describe('turnosSolapan', () => {
  it('mismo día: traslape parcial sí, turnos pegados no', () => {
    expect(turnosSolapan(oferta({ hora_inicio: '15:00:00', hora_fin_estimada: '20:00:00' }), [turno({})])).toBe(true);
    expect(turnosSolapan(oferta({ hora_inicio: '17:00:00', hora_fin_estimada: '20:00:00' }), [turno({})])).toBe(false);
  });
  it('otro día: nunca', () => {
    expect(turnosSolapan(oferta({ fecha: '2026-06-02' }), [turno({})])).toBe(false);
  });
  it('sin hora de fin cuenta hasta las 23:59:59', () => {
    expect(turnosSolapan(oferta({ hora_inicio: '22:00:00', hora_fin_estimada: null }), [turno({ hora_fin_estimada: null })])).toBe(true);
  });
  it('turno que cruza la medianoche choca con uno de la madrugada siguiente', () => {
    const noche = turno({ hora_inicio: '22:00:00', hora_fin_estimada: '02:00:00', fin_dia_siguiente: 1 });
    expect(turnosSolapan(oferta({ fecha: '2026-06-02', hora_inicio: '01:00:00', hora_fin_estimada: '05:00:00' }), [noche])).toBe(true);
    expect(turnosSolapan(oferta({ fecha: '2026-06-02', hora_inicio: '02:00:00', hora_fin_estimada: '05:00:00' }), [noche])).toBe(false);
  });
  it('una oferta que cruza la medianoche choca con un turno de esa noche', () => {
    const nocheOferta = oferta({ hora_inicio: '22:00:00', hora_fin_estimada: '02:00:00', fin_dia_siguiente: 1 });
    expect(turnosSolapan(nocheOferta, [turno({ hora_inicio: '23:00:00', hora_fin_estimada: '23:59:00' })])).toBe(true);
    expect(turnosSolapan(nocheOferta, [turno({ hora_inicio: '08:00:00', hora_fin_estimada: '12:00:00' })])).toBe(false);
  });
});
