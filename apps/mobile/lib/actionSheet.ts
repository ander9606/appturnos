import { create } from 'zustand';
import type { IconName } from '@/components/ui/Icon';

export interface ActionSheetItem {
  key: string;
  label: string;
  icon?: IconName;
  destructive?: boolean; // texto e ícono en rojo — para acciones irreversibles ("Quitar foto")
}

export interface ActionSheetOptions {
  title?: string;
  message?: string;
  items: ActionSheetItem[];
  cancelLabel?: string; // default 'Cancelar'
}

interface ActionSheetState {
  options: ActionSheetOptions | null;
  resolve: ((key: string | null) => void) | null;
  open(options: ActionSheetOptions): Promise<string | null>;
  close(key: string | null): void;
}

/** Store del menú inferior global — ver components/ui/ActionSheet.tsx (montado en _layout.tsx). */
export const useActionSheetStore = create<ActionSheetState>((set, get) => ({
  options: null,
  resolve: null,
  open: (options) => new Promise<string | null>((resolve) => set({ options, resolve })),
  close: (key) => {
    get().resolve?.(key);
    set({ options: null, resolve: null });
  },
}));

/**
 * Menú de opciones desde abajo con estilo propio (reemplaza Alert.alert con 3+ botones).
 * Resuelve el `key` de la opción elegida, o `null` si se cancela o se toca fuera.
 *   const eleccion = await actionSheet({ title: 'Foto', items: [{ key: 'camara', label: 'Tomar foto' }] });
 */
export function actionSheet(options: ActionSheetOptions): Promise<string | null> {
  return useActionSheetStore.getState().open(options);
}
