import { Modal } from './Modal';

interface Props {
  title: string;
  detail: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}

/** Modal de confirmación para acciones irreversibles — reemplaza window.confirm cuando hay que explicar la consecuencia. */
export function ConfirmModal({ title, detail, confirmLabel, onConfirm, onCancel, pending }: Props) {
  return (
    <Modal onClose={onCancel}>
      <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground mb-5">{detail}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="flex-1 bg-danger hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {pending ? 'Procesando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
