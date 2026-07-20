import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  cancelLabel?: string;   // default 'Cancelar'
  confirmLabel?: string;  // default 'Confirmar'
  destructive?: boolean;  // botón de confirmar en rojo — para acciones irreversibles
}

interface ConfirmState {
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  open(options: ConfirmOptions): Promise<boolean>;
  close(result: boolean): void;
}

/** Store mínimo para el diálogo global — ver components/ui/ConfirmDialog.tsx (montado en _layout.tsx). */
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  options: null,
  resolve: null,
  open: (options) =>
    new Promise<boolean>((resolve) => {
      set({ options, resolve });
    }),
  close: (result) => {
    get().resolve?.(result);
    set({ options: null, resolve: null });
  },
}));

/**
 * Reemplazo con estilo propio de Alert.alert para confirmaciones de 2 botones
 * (cancelar / confirmar). Resuelve `true` si el usuario confirma.
 * Para mensajes de solo-info o de más de 2 botones sigue usando Alert.alert.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().open(options);
}
