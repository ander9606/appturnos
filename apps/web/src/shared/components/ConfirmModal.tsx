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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-md">
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
      </div>
    </div>
  );
}
