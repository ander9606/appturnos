import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { confirm } from './confirmDialog';

/**
 * Confirma antes de salir de una pantalla con cambios sin guardar —
 * cubre swipe-back, botón físico Android y el back del header, no solo
 * un botón "Cancelar" a medida.
 *
 * Devuelve `allowNextLeave()` para navegaciones propias inmediatamente después
 * de un submit exitoso (p.ej. `router.replace` tras crear el registro): el
 * `hasChanges` que llega por prop puede seguir "true" un tick más porque el
 * estado de éxito de la mutación todavía no se re-renderizó.
 */
export function useConfirmDiscard(hasChanges: boolean) {
  const navigation = useNavigation();
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;
  const skipNextRef = useRef(false);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (skipNextRef.current) { skipNextRef.current = false; return; }
      if (!hasChangesRef.current) return;
      e.preventDefault();
      confirm({
        title: '¿Descartar cambios?',
        message: 'Vas a perder lo que llevas hecho en este formulario.',
        cancelLabel: 'Seguir editando',
        confirmLabel: 'Descartar',
        destructive: true,
      }).then((ok) => {
        if (ok) navigation.dispatch(e.data.action);
      });
    });
  }, [navigation]);

  return () => { skipNextRef.current = true; };
}
