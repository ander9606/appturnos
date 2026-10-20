import { create } from 'zustand';
import type { FeedbackVariant } from '@/components/ui/feedback';

interface ToastState {
  message: string | null;
  variant: FeedbackVariant;
  show(message: string, variant?: FeedbackVariant): void;
  hide(): void;
}

/** Store mínimo para el toast global — ver components/ui/Toast.tsx (montado en _layout.tsx). */
export const useToastStore = create<ToastState>((set) => ({
  message: null,
  variant: 'success',
  show: (message, variant = 'success') => set({ message, variant }),
  hide: () => set({ message: null }),
}));

/**
 * Feedback no bloqueante: por defecto de éxito; pasa 'error' | 'warning' | 'info' para otros casos.
 * Para confirmaciones de 2 botones usa confirm() (lib/confirmDialog.ts); para avisos que el usuario
 * debe leer sí o sí (errores de una acción), showAlert() (lib/alertDialog.ts).
 */
export function showToast(message: string, variant: FeedbackVariant = 'success') {
  useToastStore.getState().show(message, variant);
}
