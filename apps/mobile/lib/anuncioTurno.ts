import { create } from 'zustand';

export type TipoAnuncioTurno = 'publicado' | 'cancelado' | 'completado';

interface AnuncioTurnoState {
  mensaje: string | null;
  tipo: TipoAnuncioTurno;
  show(mensaje: string, tipo: TipoAnuncioTurno): void;
  hide(): void;
}

/** Store del anuncio que baja desde arriba — ver components/ui/AnuncioTurno.tsx (montado en _layout.tsx). */
export const useAnuncioTurnoStore = create<AnuncioTurnoState>((set) => ({
  mensaje: null,
  tipo: 'publicado',
  show: (mensaje, tipo) => set({ mensaje, tipo }),
  hide: () => set({ mensaje: null }),
}));

/**
 * Anuncio destacado, exclusivo del ciclo de vida de un turno: publicado,
 * cancelado o completado. Para el resto de confirmaciones (postularse,
 * duplicar, etc.) sigue usando showToast — ver lib/toast.ts.
 */
export function showAnuncioTurno(mensaje: string, tipo: TipoAnuncioTurno) {
  useAnuncioTurnoStore.getState().show(mensaje, tipo);
}
