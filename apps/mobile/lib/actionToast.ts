import { createOverlayStore } from './overlayStore';

export interface ActionToastOptions {
  message: string;
  actionLabel: string;
  durationMs?: number; // default 6000
}

/** Store del banner de acción — ver components/ui/ActionToast.tsx (montado en _layout.tsx). */
export const useActionToastStore = createOverlayStore<ActionToastOptions>();

/**
 * Banner no bloqueante con ventana de tiempo: se muestra unos segundos con un
 * botón de acción. Resuelve `true` si el usuario lo toca a tiempo, `false` si
 * se agota el tiempo (o se descarta) — para ofrecer una opción sin obligar a
 * responder, a diferencia de confirm() (lib/confirmDialog.ts).
 */
export function actionToast(options: ActionToastOptions): Promise<boolean> {
  return useActionToastStore.getState().open(options);
}
