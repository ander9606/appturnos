import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { FilaTurno } from '../FilaTurno';
import type { TurnoDeGrupo } from '@api-client';

// Un turno de grupo cancelado por fuerza mayor con compensación NO se muestra como un cancelado a secas.
const turno = (extra: Partial<TurnoDeGrupo> = {}): TurnoDeGrupo => ({
  id: 1, titulo: 'Montaje Gala', fecha: '2026-11-03', hora_inicio: '08:00:00', hora_fin_estimada: '16:00:00',
  fin_dia_siguiente: null, lugar: null, estado: 'publicada', plazas: 3, plazas_cubiertas: 2, ...extra,
} as TurnoDeGrupo);

describe('FilaTurno (grupo)', () => {
  test('turno normal: plazas cubiertas', () => {
    render(<FilaTurno turno={turno()} onPress={jest.fn()} />);
    expect(screen.getByText(/2 de 3 plazas cubiertas/)).toBeTruthy();
  });

  test('cancelado a secas: «Cancelado» y tachado', () => {
    render(<FilaTurno turno={turno({ estado: 'cancelada' })} onPress={jest.fn()} />);
    expect(screen.getByText(/Cancelado/)).toBeTruthy();
    expect(screen.queryByText(/Turno fallido/)).toBeNull();
  });

  test('cancelado con fallidos: «Turno fallido · N compensados», no «Cancelado»', () => {
    render(<FilaTurno turno={turno({ estado: 'cancelada', fallidos: 2 })} onPress={jest.fn()} />);
    expect(screen.getByText('Turno fallido · 2 compensados')).toBeTruthy();
    expect(screen.queryByText(/· Cancelado/)).toBeNull();
  });

  test('un solo compensado va en singular', () => {
    render(<FilaTurno turno={turno({ estado: 'cancelada', fallidos: 1 })} onPress={jest.fn()} />);
    expect(screen.getByText('Turno fallido · 1 compensado')).toBeTruthy();
  });
});
