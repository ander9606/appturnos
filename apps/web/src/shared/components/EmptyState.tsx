interface Props {
  message: string;
  action?: { label: string; onClick: () => void };
}

/** Estado "sin datos" de una lista — mismo look en toda la app, con CTA opcional. */
export function EmptyState({ message, action }: Props) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && (
        <button onClick={action.onClick} className="mt-2 text-sm text-primary hover:text-primary-600 font-medium">
          {action.label}
        </button>
      )}
    </div>
  );
}
