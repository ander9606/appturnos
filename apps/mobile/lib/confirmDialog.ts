import { createOverlayStore } from './overlayStore';
import type { FeedbackVariant } from '@/components/ui/feedback';

export interface ConfirmOptions {
  title: string;
  message?: string;
  cancelLabel?: string;   // default 'Cancelar'
  confirmLabel?: string;  // default 'Confirmar'
  destructive?: boolean;  // botón de confirmar en rojo — para acciones irreversibles
  variant?: FeedbackVariant; // ícono/color del aviso en vez de la papelera (ej. 'warning' para una advertencia con consecuencia)
}

/** Store del diálogo global — ver components/ui/ConfirmDialog.tsx (montado en _layout.tsx). */
export const useConfirmStore = createOverlayStore<ConfirmOptions>();

/**
 * Reemplazo con estilo propio de Alert.alert para confirmaciones de 2 botones
 * (cancelar / confirmar). Resuelve `true` si el usuario confirma.
 * Para avisos de un botón usa showAlert() (lib/alertDialog.ts); para menús de más de 2 opciones
 * usa actionSheet() (lib/actionSheet.ts).
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().open(options);
}
