import { create, type UseBoundStore, type StoreApi } from 'zustand';

export interface OverlayState<TOptions> {
  options: TOptions | null;
  resolve: ((value: boolean) => void) | null;
  open(options: TOptions): Promise<boolean>;
  close(result: boolean): void;
}

/**
 * Fábrica de un store zustand mínimo para overlays que se resuelven como
 * `Promise<boolean>` (confirm() en confirmDialog.ts, actionToast() en
 * actionToast.ts). Ambos comparten la misma forma — abrir guarda `options` +
 * `resolve`, cerrar resuelve la promesa y limpia — solo cambian las opciones
 * y el componente que los renderiza.
 */
export function createOverlayStore<TOptions>(): UseBoundStore<StoreApi<OverlayState<TOptions>>> {
  return create<OverlayState<TOptions>>((set, get) => ({
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
}
