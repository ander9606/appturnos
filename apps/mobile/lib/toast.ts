import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show(message: string): void;
  hide(): void;
}

/** Store mínimo para el toast global — ver components/ui/Toast.tsx (montado en _layout.tsx). */
export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  hide: () => set({ message: null }),
}));

/**
 * Feedback no bloqueante para acciones exitosas.
 * Para confirmaciones de 2 botones usa confirm() (lib/confirmDialog.ts).
 * Para errores o mensajes de más de 2 botones sigue usando Alert.alert.
 */
export function showToast(message: string) {
  useToastStore.getState().show(message);
}
