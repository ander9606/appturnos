import { create } from 'zustand';
import type { FeedbackVariant } from '@/components/ui/feedback';

export interface AlertOptions {
  title: string;
  message?: string;
  okLabel?: string; // default 'Entendido'
  variant?: FeedbackVariant; // default 'error'
}

interface AlertState {
  options: AlertOptions | null;
  resolve: (() => void) | null;
  open(options: AlertOptions): Promise<void>;
  close(): void;
}

/** Store mínimo para el diálogo de error global — ver components/ui/AlertDialog.tsx (montado en _layout.tsx). */
export const useAlertStore = create<AlertState>((set, get) => ({
  options: null,
  resolve: null,
  open: (options) =>
    new Promise<void>((resolve) => {
      set({ options, resolve });
    }),
  close: () => {
    get().resolve?.();
    set({ options: null, resolve: null });
  },
}));

/**
 * Reemplazo con estilo propio de Alert.alert para avisos de un solo botón.
 * `variant` cambia ícono y color: 'error' (falló algo), 'warning' (falta o está mal un dato),
 * 'info' o 'success'. Para confirmaciones de 2 botones usa confirm() (lib/confirmDialog.ts).
 */
export function showAlert(title: string, message?: string, variant: FeedbackVariant = 'error'): Promise<void> {
  return useAlertStore.getState().open({ title, message, variant });
}

/** Atajo de showAlert(..., 'error'). */
export function alertError(title: string, message: string): Promise<void> {
  return showAlert(title, message, 'error');
}
