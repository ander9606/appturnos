import { createOverlayStore } from './overlayStore';

export interface ConfirmOptions {
  title: string;
  message?: string;
  cancelLabel?: string;   // default 'Cancelar'
  confirmLabel?: string;  // default 'Confirmar'
  destructive?: boolean;  // botón de confirmar en rojo — para acciones irreversibles
}

/** Store del diálogo global — ver components/ui/ConfirmDialog.tsx (montado en _layout.tsx). */
export const useConfirmStore = createOverlayStore<ConfirmOptions>();

/**
 * Reemplazo con estilo propio de Alert.alert para confirmaciones de 2 botones
 * (cancelar / confirmar). Resuelve `true` si el usuario confirma.
 * Para mensajes de solo-info o de más de 2 botones sigue usando Alert.alert.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().open(options);
}
