import { create } from 'zustand';

interface AvisoEmpresaState {
  mensaje: string | null;
  show(mensaje: string): void;
  hide(): void;
}

/** Store del aviso accionable (toca para ver) cuando llega una invitación de
 * empresa mientras la app está abierta — ver components/ui/AvisoEmpresa.tsx
 * (montado en _layout.tsx) y el listener de push en _layout.tsx (AuthGuard). */
export const useAvisoEmpresaStore = create<AvisoEmpresaState>((set) => ({
  mensaje: null,
  show: (mensaje) => set({ mensaje }),
  hide: () => set({ mensaje: null }),
}));

export function showAvisoEmpresa(mensaje: string) {
  useAvisoEmpresaStore.getState().show(mensaje);
}
