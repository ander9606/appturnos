import { useState } from 'react';

interface ConfirmState {
  title: string;
  detail: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

/** Reemplaza window.confirm por ConfirmModal sin repetir el useState/handler en cada página. */
export function useConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  return {
    confirmState,
    confirm: (opts: ConfirmState) => setConfirmState(opts),
    close: () => setConfirmState(null),
  };
}
