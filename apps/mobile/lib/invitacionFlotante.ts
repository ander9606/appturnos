import { create } from 'zustand';
import type { Vinculo } from '@api-client';

interface InvitacionFlotanteState {
  vinculo: Vinculo | null;
  show(vinculo: Vinculo): void;
  hide(): void;
}

/** Store de la tarjeta flotante de invitación — ver
 * components/ui/InvitacionFlotanteCard.tsx (montada en _layout.tsx) y el
 * disparador en _layout.tsx (AuthGuard: push recibido / login). */
export const useInvitacionFlotanteStore = create<InvitacionFlotanteState>((set) => ({
  vinculo: null,
  show: (vinculo) => set({ vinculo }),
  hide: () => set({ vinculo: null }),
}));

export function showInvitacionFlotante(vinculo: Vinculo) {
  useInvitacionFlotanteStore.getState().show(vinculo);
}
